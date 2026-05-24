# 🚗⚡ Road Trip EV

Web app PWA mobile-first pour piloter en temps réel un road trip en voiture électrique.

**URL** : https://elricsonn.github.io/roadtrip-ev/

**Concept** : pré-rempli avec les prévisions du voyage (étapes, distances, durées, charges batterie), saisie ultra-rapide des valeurs réelles à chaque arrêt, calculs live de la conso (kWh/100 km), de l'autonomie projetée et de l'écart vs théorique. Fonctionne offline une fois chargée. Export JSON des données saisies pour réinjection dans le classeur Excel canonique au retour.

## Voyage actuel
Smart #3 Brabus (62 kWh, théorique 0,205 kWh/km) — juin 2026 : Monaco → Narbonne → Rocamadour → Lourdes (3 nuits) → Rians → Monaco. Référence : Monaco↔Draguignan (déjà mesuré).

## Installation sur iPhone
1. Ouvrir l'URL dans Safari iPhone
2. Bouton Partager → **Ajouter à l'écran d'accueil**
3. L'icône apparaît, l'app se lance en plein écran (mode PWA standalone)

## Stack
HTML + CSS + JS vanilla. LocalStorage pour persistance. Aucune dépendance externe. Hébergement GitHub Pages.

## Données source
Le `data.json` est extrait du classeur Excel `Rocamadour Lourdes 2026 - Itinéraire - {date}.xlsx` (slot V2 Dropbox `10.05.03`). Pour régénérer après modif du classeur, voir `extract_data.py` (TODO : à formaliser).
