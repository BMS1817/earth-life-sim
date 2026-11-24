# Earth UI prototype — art direction

- Scope: isolated main event, people master-detail and memorial dossier; production UI is unchanged.
- Source: Kenney, UI Pack - Pixel Adventure, CC0 1.0, https://kenney.nl/assets/ui-pack-pixel-adventure.
- Material language: warm parchment, carved wood, muted violet metal fittings and restrained gold edges.
- Source geometry: 32×32 RGBA PNG, thick-outline large tiles. No resizing, anti-aliasing or new intermediate alpha.
- Assembly: CSS border-image 9-slice, 10 px or 12 px source slices; nearest-neighbor display.
- Main panels: `panel.png`; repeated cards: `card.png`; neutral and selected controls: `button.png`, `button-active.png`.
- Choices retain Earth sector meaning: tradition gold, change blue, bonds pink, self violet. Text stays dark on light fills.
- Canvas: 256×192 at 1× or 512×384 at 2×; portraits 64×64 at 1× or 128×128 at 2×; memory scenes 128×72 at 2× or 4×.
- Status: 9 derived components inspected in `../component-preview.png`; full 36-state UI matrix and interaction checks are in `shots/ui-prototype/report.json`.
- Provenance: exact RGB substitutions are reproducible with `../build_assets.py`; source ZIP SHA-256 is recorded in `kenney-license.json`. No AI training use.
