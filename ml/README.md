# KoraVibe English research prototype

This is a real trained TF-IDF + multinomial logistic-regression text classifier. It predicts goal, card, shot, or regular play from English commentary. It does not classify raw audio. Microphone input uses the browser's separate English speech recognition service, which may send audio to the browser vendor.

Automatic vibration is deliberately paused in this release. Manual pulse buttons are labelled as manual tests. The first experiment achieved macro F1 0.3801 and did not meet the automatic-alert criterion (80% precision on at least 8 validation windows). The current build's complete results are in reports/metrics.json.

## Reproducible data and training
Run pip install -r ml/requirements.txt, then python ml/build.py and node ml/test_engine.cjs.
The build downloads a deterministic sample of 120 matches from SoccerNet-Echoes whisper_v2_en and matching SoccerNet event annotations, at immutable revisions recorded in the code and manifest. The original download contained 344 files, with 16 absent label files; 104 complete matches were used. No gated video or raw audio is downloaded.

15-second commentary windows advance by 10 seconds. Only completed transcript segments are included. Labels come independently from event timestamps; goals take precedence over simultaneous shots, other overlapping target types are excluded. Yellow/red cards are combined, as are on/off-target shots. Timestamp alignment creates noisy labels and has not been manually audited.

Whole matches are split into 72 train, 16 validation, 16 test. Exact normalized duplicate texts are removed. TF-IDF is fitted only on training data. C is selected from 1 and 4 using validation macro F1. Test data is not used for model selection. Rebuilding reproduces the prior experiment, not a new independent test. Scores are not calibrated real-event probabilities.

The original experiment had 34,309 train / 7,576 validation / 7,537 test windows. Test accuracy was 86.94%, lower than the 92.13% always-background accuracy; macro F1 was 38.01%. Do not interpret ordinary accuracy as successful football event recognition. See the current JSON report for regenerated values.

## Integration
Load ai/engine.js, call KoraVibeAI.load('ai/model.json'), then model.predict(text). The interface emits koravibe:prediction events. All returned eligible flags are false in this release; no automatic vibration is emitted. Manual patterns: goal [400,100,400,100,900], card [150,80,150], shot [250] milliseconds. Patterns are from the project demo, not validated accessibility recommendations.

## Validation and limitations
The build verifies source file hashes, disjoint match splits and Python/JavaScript prediction parity. Browser tests check desktop/mobile overflow, actual model inference, examples, error recovery and simulated microphone lifecycle. Physical phone haptics, real microphone ASR, end-to-end latency and accessibility-user benefit still require testing.

The next scientific step is manual review of transcript/event alignment, including missed chances, disallowed goals, replays and references to earlier events; then evaluation on new matches. More data alone does not fix weak labels.

## Sources and attribution
- SoccerNet-Echoes, Gautam et al. (2024), https://arxiv.org/abs/2405.07354
- https://github.com/SoccerNet/sn-echoes
- https://huggingface.co/datasets/SoccerNet/SN-echoes (CC BY 4.0)
- SoccerNet-v2, Deliege et al. (2021), https://arxiv.org/abs/2011.13367
- https://huggingface.co/datasets/SoccerNet/SN-Labels
- https://www.soccer-net.org/tasks/action-spotting

Source labels retain their own terms; this project does not relicense them. Raw training data is excluded from the public website. Only the model, a small attributed sample, evaluation and documentation are deployed. Generated models/reports and training provenance are available as workflow artifacts.
