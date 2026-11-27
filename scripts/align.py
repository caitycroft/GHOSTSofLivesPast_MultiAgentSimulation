# Forced alignment of a voiceover take to its script, so each line's start and
# end in the recording is known to the hundredth of a second. Uses PocketSphinx
# (pip install pocketsphinx; its English model ships with the package).
#
#   python3 scripts/align.py take.m4a "Opening A" out.json [--scripts media/thanksgiving/scripts.json] [--from 8.8] [--to 94]
#
# --from skips anything before the first line (a false start, a cough).
import json, re, subprocess, sys
from pocketsphinx import Decoder

args = sys.argv[1:]
opt = lambda name, default: args[args.index(name) + 1] if name in args else default
audio, length, out = args[0], args[1], args[2]
scripts = json.load(open(opt('--scripts', 'media/thanksgiving/scripts.json')))
t0, t1 = float(opt('--from', 0)), float(opt('--to', 1e9))

# 16 kHz mono, lifted so a quiet take decodes as well as a loud one
lufs = float(re.search(r'I:\s+(-?[\d.]+) LUFS', subprocess.run(['ffmpeg', '-hide_banner', '-i', audio, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], capture_output=True, text=True).stderr).group(1))
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', audio, '-ac', '1', '-ar', '16000', '-af', f'volume={-20 - lufs:.1f}dB', '-f', 's16le', '-'], capture_output=True).stdout
raw = raw[int(t0 * 16000) * 2: int(min(t1, len(raw) / 32000) * 16000) * 2]

cut = next(c for c in scripts if c['length'] == length)
words = lambda s: re.sub(r"[^a-z' ]", ' ', s.lower().replace('\u2019', "'")).split()
lines = [words(l['text']) for l in cut['lines']]
d = Decoder(samprate=16000, loglevel='FATAL')
d.set_align_text(' '.join(w for l in lines for w in l))
d.start_utt(); d.process_raw(raw, full_utt=True); d.end_utt()
segs = [(s.word, s.start_frame / 100 + t0, (s.end_frame + 1) / 100 + t0) for s in d.seg() if s.word not in ('<s>', '</s>', '<sil>', '(NULL)')]
if len(segs) != sum(map(len, lines)):
    sys.exit(f'aligned {len(segs)} of {sum(map(len, lines))} words: the take may not match the script')
res, k = [], 0
for i, l in enumerate(lines):
    ws = segs[k:k + len(l)]; k += len(l)
    res.append({'text': cut['lines'][i]['text'], 'start': round(ws[0][1], 2), 'end': round(ws[-1][2], 2),
                'words': [{'w': w, 'start': round(a, 2), 'end': round(b, 2)} for w, a, b in ws]})
json.dump(res, open(out, 'w'), indent=1)
print(f'aligned {len(segs)} words in {len(res)} lines -> {out}')
