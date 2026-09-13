#!/usr/bin/env python3
"""Build 128 distinct four-bar phrases from the CC BY 4.0 CRÉ MIDI corpus.
Usage: python scripts/import-melodies.py /tmp/folk-corpus.tar.gz /tmp/folk-tree.json
The tree pins the upstream revision and every selected source is blob-hash verified.
No network requests or third-party Python packages are needed by this importer.
"""
import csv
import hashlib
import html
import io
import json
from pathlib import Path
import re
import struct
import sys
import tarfile

ROOT = Path(__file__).resolve().parents[1]
MODES = {'dorian': [0,2,3,5,7,9,10], 'minor': [0,2,3,5,7,8,10], 'major': [0,2,4,5,7,9,11], 'mixolydian': [0,2,4,5,7,9,10]}
REPO = 'https://github.com/polifonia-project/folk_ngram_analysis'

def midi_notes(data):
    assert data[:4] == b'MThd'
    header_size = int.from_bytes(data[4:8], 'big')
    _, tracks, division = struct.unpack('>HHH', data[8:14])
    assert not division & 0x8000
    offset, notes, title, meters = 8 + header_size, [], '', []
    for track in range(tracks):
        assert data[offset:offset+4] == b'MTrk'
        size = int.from_bytes(data[offset+4:offset+8], 'big')
        buf = data[offset+8:offset+8+size]; offset += size + 8
        pos, tick, status, active = 0, 0, 0, {}
        def vlq():
            nonlocal pos
            value = 0
            while True:
                byte = buf[pos]; pos += 1
                value = (value << 7) | (byte & 127)
                if byte < 128: return value
        while pos < len(buf):
            tick += vlq()
            if buf[pos] & 128: status = buf[pos]; pos += 1
            if status == 0xff:
                kind = buf[pos]; pos += 1
                length = vlq(); payload = buf[pos:pos+length]; pos += length
                if kind == 3 and not title: title = payload.decode('utf-8', errors='replace').strip()
                if kind == 0x58: meters.append((payload[0], 2**payload[1]))
            elif status in [0xf0, 0xf7]:
                length = vlq(); pos += length
            else:
                kind, channel = status >> 4, status & 15
                assert 8 <= kind <= 14
                length = 1 if kind in [12, 13] else 2
                payload = buf[pos:pos+length]; pos += length
                if channel == 9: continue
                pitch = payload[0]
                if kind == 9 and payload[1] > 0: active[(channel, pitch)] = tick
                elif kind == 8 or (kind == 9 and payload[1] == 0):
                    start = active.pop((channel, pitch), None)
                    if start is not None and tick > start: notes.append((start, pitch, tick-start))
    return sorted(notes), division, title, meters

def main():
    tree = json.loads(Path(sys.argv[2]).read_text())
    commit = tree['sha']; objects = {x['path']: x['sha'] for x in tree['tree']}
    with tarfile.open(sys.argv[1]) as archive:
        members = {m.name.split('/', 1)[1]: m for m in archive.getmembers() if '/' in m.name and m.isfile()}
        def read(path):
            data = archive.extractfile(members[path]).read()
            blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
            assert blob == objects[path], f'Unpinned source: {path}'
            return data
        roots = {row[0]: int(row[1]) for row in list(csv.reader(io.StringIO(read('cre_corpus/roots.csv').decode())))[1:]}
        candidates = [p for p in members if p.startswith('cre_corpus/MIDI/') and p.endswith('.mid')]
        # Deterministic hash order spreads the sample across titles rather than taking only A–D.
        candidates.sort(key=lambda p: hashlib.sha256(p.encode()).hexdigest())
        tunes, credits, fingerprints = [], [], set()
        dest = ROOT / 'public/music'; (dest / 'sources').mkdir(parents=True, exist_ok=True)
        for path in candidates:
            stem = Path(path).stem
            if stem not in roots: continue
            raw = read(path)
            notes, division, title, meters = midi_notes(raw)
            if not notes or not meters or any(m not in [(4,4), (2,2), (2,4)] for m in meters): continue
            start_tick = notes[0][0]
            excerpt = [(round((t-start_tick)*4/division), pitch, max(1, round(length*4/division))) for t,pitch,length in notes if (t-start_tick)*4/division < 64]
            # Skip ornaments quantized onto another onset and non-monophonic files.
            if len({n[0] for n in excerpt}) != len(excerpt) or len(excerpt) < 16: continue
            tonic = 60 + roots[stem]
            pitch_classes = {(pitch-tonic) % 12 for _,pitch,_ in excerpt}
            options = [mode for mode, scale in MODES.items() if pitch_classes <= set(scale)]
            if not options: continue
            mode = options[0]
            scale = MODES[mode]
            phrase = []
            for i, (step,pitch,length) in enumerate(excerpt):
                octave, pc = divmod(pitch-tonic, 12)
                end = excerpt[i+1][0] if i+1 < len(excerpt) else 64
                phrase.append([step, octave*7 + scale.index(pc), min(length, end-step, 64-step)])
            # Normalize octaves, retaining all source intervals and rhythm.
            shift = (sorted(n[1] for n in phrase)[len(phrase)//2] // 7) * 7
            for n in phrase: n[1] -= shift
            fingerprint = json.dumps(phrase)
            if fingerprint in fingerprints: continue
            fingerprints.add(fingerprint)
            # Prefer readable source track titles over CamelCase file stems.
            title = title or re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', stem)
            title = re.sub(r'\s+', ' ', title).strip()
            if title.lower() in ['track 1','untitled']: title = stem
            ident = 'cre-' + hashlib.sha256(path.encode()).hexdigest()[:12]
            # Choose diatonic accompaniment roots that support the source notes in each bar.
            progression = []
            for bar in range(4):
                pitches = [degree % 7 for step,degree,_ in phrase if bar*16 <= step < (bar+1)*16]
                choices = [0,3,4,5,6,1]
                chord = max(choices, key=lambda root: sum(2 if d in {root,(root+2)%7,(root+4)%7} else 0 for d in pitches))
                progression.append(chord)
            tunes.append(dict(id=ident, title=title, mode=mode, progression=progression, notes=phrase))
            source = f'{REPO}/blob/{commit}/{path}'
            credits.append(dict(id=ident, title=title, source=source, sourceFile=Path(path).name,
                sha256=hashlib.sha256(raw).hexdigest(), rootPitchClass=roots[stem], mode=mode,
                excerptStartTick=start_tick, ticksPerQuarter=division, sourceNoteCount=len(notes),
                license='CC-BY-4.0', licenseURL='https://creativecommons.org/licenses/by/4.0/'))
            (dest / 'sources' / Path(path).name).write_bytes(raw)
            if len(tunes) == 128: break
        assert len(tunes) == 128, f'Only {len(tunes)} suitable distinct tunes'
        (dest / 'UPSTREAM-README.md').write_bytes(read('cre_corpus/README.md'))
        (dest / 'UPSTREAM-LICENSE.md').write_bytes(read('cre_corpus/LICENSE.md'))
        (dest / 'credits.json').write_text(json.dumps(dict(repository=REPO, commit=commit, corpus='Ceol Rince na hÉireann',
            attribution='CRÉ corpus: Danny Diamond, Abdul Shahid and James McDermott / Polifonia. ABC transcriptions: Bill Black. Original tune collection: Breandán Breathnach.',
            license='CC-BY-4.0 (corpus README); upstream software LICENSE is also retained.',
            modifications='Four-bar excerpts; initial pickup moved to step 0; sixteenth-note quantization; octave/key normalization; modal encoding; new accompaniment, synthesis, sector tunings and one optional passing-note alteration.', tunes=credits), indent=2)+'\n')
        data_dir = ROOT / 'src/data'; data_dir.mkdir(exist_ok=True)
        (data_dir / 'melodies.json').write_text(json.dumps(tunes, ensure_ascii=False, separators=(',', ':'))+'\n')
        links = ''.join(f'<li>{html.escape(t["title"])} · <a href="{html.escape(t["source"])}">Source</a> · <a href="sources/{html.escape(t["sourceFile"])}">Original MIDI</a></li>' for t in credits)
        (dest / 'credits.html').write_text(f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>over.run · Music credits</title><style>body{{background:#10191e;color:#d5dedb;font:16px/1.7 system-ui;max-width:850px;margin:40px auto;padding:20px}}a{{color:#b9f578}}li{{margin:8px 0}}</style><h1>Music credits</h1><p>128 melodies adapted from <a href="{REPO}/tree/{commit}/cre_corpus">Ceol Rince na hÉireann / Polifonia</a>.</p><p>Corpus: Danny Diamond, Abdul Shahid and James McDermott. ABC transcriptions: Bill Black. Original tune collection: Breandán Breathnach.</p><p>Corpus data licensed under <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0</a> (<a href="CC-BY-4.0.txt">offline license text</a>). <a href="UPSTREAM-README.md">Original corpus notice</a> · <a href="UPSTREAM-LICENSE.md">Upstream software notice</a> · <a href="credits.json">Complete source record</a>.</p><p>Adaptations by over.run: four-bar excerpts, pickup alignment, sixteenth-note timing, octave/key normalization, generated accompaniment, synthesis, tunings and occasional passing-note variation. No endorsement by the source authors is implied.</p><ol>{links}</ol></html>''')
        print(f'Imported {len(tunes)} distinct MIDI melodies from {commit}. Modes:', {m:sum(t['mode']==m for t in tunes) for m in MODES})

if __name__ == '__main__': main()
