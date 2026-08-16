# SV Twello Zondag 2 – teamdashboard

Openbaar teamdashboard voor seizoen 2026-2027. De Excel in `data/2026-2027_zondag2.xlsx` is de enige bron; de website bundelt alleen de benodigde teamgegevens en geen leeftijden of geboortedata.

## Bijwerken op de Mac

1. Pas de Excel aan en wacht totdat OneDrive klaar is met synchroniseren.
2. Werk lokaal bij en controleer:

   ```bash
   pnpm run test
   ```

3. GitHub Actions bouwt en publiceert de website automatisch.

De Excel staat in deze repository en wordt tijdens de Vite-build direct in de website gebundeld. Er is geen `team.json` of andere handmatig bijgehouden export nodig.

## Branches

- `main` is de openbare, werkende versie en wordt automatisch gepubliceerd.
- Voor alleen gegevens bijwerken is geen aparte branch nodig.
- Gebruik een tijdelijke branch bij grotere wijzigingen aan ontwerp of werking; voeg die na controle samen met `main`.

## Lokaal bekijken

```bash
pnpm install
pnpm run dev
```
