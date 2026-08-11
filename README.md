# SV Twello Zondag 2 – teamdashboard

Openbaar teamdashboard voor seizoen 2026-2027. De gedeelde Excel in OneDrive is de bron; de website publiceert alleen de benodigde teamgegevens en geen leeftijden of geboortedata.

## Bijwerken op de Mac

1. Pas de gedeelde Excel aan en wacht totdat OneDrive klaar is met synchroniseren.
2. Open deze map in Codex en geef aan wat gewijzigd is, of voer lokaal uit:

   ```bash
   pnpm run extract:excel -- "/Users/jpdh/Library/CloudStorage/OneDrive-Persoonlijk/SV Twello zondag 2/2026-2027_zondag2.xlsx"
   pnpm run test
   git add public/data/team.json
   git commit -m "Werk dashboardgegevens bij"
   git push origin main
   ```

3. GitHub Actions bouwt en publiceert de website automatisch.

De Excel zelf hoort niet in deze openbare repository. Alleen `public/data/team.json` gaat naar GitHub.

## Branches

- `main` is de openbare, werkende versie en wordt automatisch gepubliceerd.
- Voor alleen gegevens bijwerken is geen aparte branch nodig.
- Gebruik een tijdelijke branch bij grotere wijzigingen aan ontwerp of werking; voeg die na controle samen met `main`.

## Lokaal bekijken

```bash
pnpm install
pnpm run dev
```
