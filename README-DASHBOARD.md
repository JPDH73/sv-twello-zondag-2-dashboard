# SV Twello 2 teamdashboard

Dit dashboard gebruikt `public/data/team.json`. Dat bestand wordt automatisch gemaakt vanuit `2026-2027_zondag2.xlsx` in de lokale OneDrive-map. In GitHub Actions kan hetzelfde bestand iedere 15 minuten via een beveiligde downloadlink worden gecontroleerd.

## Gegevens bijwerken

1. Vul het Excel-bestand zoals gebruikelijk in en sla het op.
2. Voer lokaal uit:

   `pnpm run update-data`

4. Controleer de website met `pnpm run dev`.
De standaard OneDrive-locatie wordt automatisch gevonden. Een afwijkend bestand kan nog steeds als argument of via `TEAM_EXCEL_PATH` worden meegegeven.

## Automatisch publiceren vanuit OneDrive

Voeg in GitHub bij **Settings → Secrets and variables → Actions** één secret toe met de naam `TEAM_EXCEL_URL`. Gebruik als waarde een downloadlink naar het Excel-bestand. De workflow controleert het bestand daarna iedere 15 minuten, genereert de actuele dashboardgegevens en publiceert de website opnieuw. Zonder deze secret blijft de laatst gegenereerde, geldige dataset actief.

De GitHub Actions-workflow bouwt en publiceert daarna automatisch de nieuwe versie op GitHub Pages.

## Eenmalige GitHub Pages-instelling

Maak een repository, push deze projectmap en kies bij **Settings → Pages → Build and deployment** voor **GitHub Actions**.

Het Excel-bestand zelf hoeft niet in de repository te staan. Alleen het gegenereerde JSON-bestand wordt gepubliceerd. Een laatste uitslag wordt uitsluitend gekozen uit wedstrijden met een echte numerieke eindstand. Voor de optionele ster ondersteunt het werkblad `wedstrijden` onder meer de kolomkoppen `Man van de wedstrijd`, `MVP` en `MOTM`; ook een MVP-markering per speler in `wedstrijdinvoer_spelers` wordt herkend.
