# VARUNA: Validation Protocol & Scientific Integrity

**Document**: Anti-Leakage Chronological Validation Protocol  
**Status**: Authoritative  

---

## 1. Zero Temporal Leakage Principle

Weather prediction is strictly an autoregressive, time-dependent process. Shuffling time-series observations or performing random $k$-fold cross-validation causes severe information leakage:
- If date $T+1$ is in the training set and date $T$ is in the test set, the model memorizes atmospheric persistence and synoptic persistence, producing artificially low errors.

### The VARUNA Chronological Split
All meta-model evaluation strictly partitions aligned datasets chronologically:
- **Training Set**: Earliest 75% of timestamps ($T_0 \dots T_{k}$).
- **Validation/Test Set**: Remaining 25% of subsequent timestamps ($T_{k+1} \dots T_{\text{end}}$).
- **Out-of-Time Verification**: Models are evaluated exclusively on future data they have never encountered during gradient boosting.

---

## 2. Invariant Rules of Scientific Integrity

1. **No Synthetic Waveforms**: Verification curves and RMSE values are derived from actual differences against ERA5 reanalysis reference points.
2. **No Hardcoded Multipliers**: The system strictly prohibits synthetic scaling constants (e.g. `blend_rmse = min_rmse * 0.78`).
3. **No Phantom Sample Counts**: Sample counts ($N$) must match the exact number of rows in the evaluated dataframe.
4. **Transparent Degradation**: If an external API is unavailable or returns nulls, the system shifts to `REPLAY` or `DEMO` mode with an explicit badge in the UI.
