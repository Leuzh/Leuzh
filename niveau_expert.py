from pathlib import Path
from datetime import datetime
import shutil

f = Path("index.html")
html = f.read_text(encoding="utf-8")

debut = "      // Chasse aux plumes, débloquée après la deuxième énigme."
fin = "    })();"

if html.count(debut) != 1:
    raise SystemExit(
        "Arrêt : le bloc JavaScript des plumes est introuvable "
        "ou présent plusieurs fois. Aucun changement effectué."
    )

# Repérer la fermeture finale du script principal.
pos_debut = html.index(debut)
pos_fin = html.rfind(fin)

if pos_fin <= pos_debut:
    raise SystemExit("Arrêt : fermeture JavaScript introuvable.")

# Vérifier les cinq boutons existants.
for n in range(1, 6):
    if html.count(f'data-feather="{n}"') != 1:
        raise SystemExit(
            f"Arrêt : plume {n} absente ou présente plusieurs fois."
        )

# Ajouter le panneau d'indice progressif.
ancre_indice = (
    '            <p id="cie-final-feedback" class="cie-feedback" '
    'aria-live="polite"></p>'
)
if html.count(ancre_indice) != 1:
    raise SystemExit(
        "Arrêt : emplacement du panneau d'indice introuvable."
    )

if 'id="cie-hunt-hint"' in html:
    raise SystemExit("Le panneau d'indices existe déjà. Aucun changement.")

html = html.replace(
    ancre_indice,
    ancre_indice + '''
            <div id="cie-hunt-hint" class="cie-hunt-hint" hidden>
              <strong>Indice de la CIE</strong>
              <p id="cie-hunt-hint-text" aria-live="polite"></p>
            </div>''',
    1
)

# Ajouter un style discret sans supprimer les styles actuels.
style = r'''
    /* Chasse expert : les plumes se fondent dans le décor. */
    .cie-feather {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      min-width: 18px;
      min-height: 18px;
      margin: 0 1px;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: rgba(220, 200, 255, .22);
      font-size: 0;
      line-height: 1;
      opacity: .22;
      vertical-align: baseline;
      cursor: pointer;
      box-shadow: none;
    }
    .cie-feather::after {
      content: "·";
      font-size: 15px;
      line-height: 1;
    }
    .cie-feather:hover,
    .cie-feather:focus-visible {
      color: #d9c1ff;
      opacity: .85;
      outline: 1px dotted rgba(217,193,255,.65);
    }
    .cie-feather.found {
      color: rgba(220, 200, 255, .35);
      opacity: .4;
      box-shadow: none;
    }
    .cie-feather.found::after {
      content: "·";
    }
    .cie-hunt-hint {
      margin-top: 12px;
      padding: 12px;
      border-left: 2px solid rgba(190,150,255,.55);
      background: rgba(125,82,180,.08);
      border-radius: 0 8px 8px 0;
      color: #d9c1ff;
    }
    .cie-hunt-hint p {
      margin: 6px 0 0;
      color: inherit;
    }
'''
if html.count("</style>") != 1:
    raise SystemExit("Arrêt : balise CSS de fermeture inattendue.")
html = html.replace("</style>", style + "\n  </style>", 1)

# Remplacer uniquement la logique ajoutée des plumes.
nouveau_js = r'''      // Chasse expert : cinq plumes et des indices progressifs.
      const featherForm = document.getElementById("cie-final-form");
      const featherButtons = [...document.querySelectorAll("[data-feather]")];
      const finalArchiveTrigger = document.querySelector(".cie-final-trigger");
      const finalFeedback = document.getElementById("cie-final-feedback");
      const hintPanel = document.getElementById("cie-hunt-hint");
      const hintText = document.getElementById("cie-hunt-hint-text");

      const featherHints = [
        "Je suis au seuil du monde, là où ton univers se présente avant l'ouverture des fenêtres.",
        "Cherche l'endroit où tu expliques pourquoi tu refuses de tenir dans une seule étiquette.",
        "Je me tiens près des noms des mondes que tu aimes collectionner et explorer.",
        "Les souvenirs ont quatre fenêtres. L'une d'elles garde une trace qui n'est pas une image.",
        "Pour me trouver, cherche l'endroit où ton univers se prolonge au-delà de ce site."
      ];

      let feathersUnlocked = false;
      const feathersFound = new Set();

      function showNextHint() {
        if (!feathersUnlocked || !hintPanel || !hintText) return;

        if (feathersFound.size >= featherButtons.length) {
          hintPanel.hidden = true;
          return;
        }

        hintPanel.hidden = false;
        hintText.textContent = featherHints[feathersFound.size];
      }

      if (featherForm) {
        featherForm.addEventListener("submit", () => {
          const answer = (
            document.getElementById("cie-final-answer").value || ""
          ).trim().toLocaleLowerCase("fr-FR").normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

          const accepted = [
            "livre", "un livre", "le livre",
            "une histoire", "histoire",
            "un texte", "texte",
            "l'ecriture", "ecriture"
          ];

          if (accepted.includes(answer)) {
            feathersUnlocked = true;
            featherButtons.forEach(button => {
              button.hidden = false;
            });
            showNextHint();
            finalFeedback.textContent =
              "La serrure cède. Cinq traces minuscules attendent dans les pages du site.";
          }
        });
      }

      featherButtons.forEach(button => {
        button.addEventListener("click", () => {
          if (!feathersUnlocked) return;

          const numero = button.dataset.feather;
          if (feathersFound.has(numero)) return;

          feathersFound.add(numero);
          button.classList.add("found");
          button.disabled = true;
          button.setAttribute("aria-label", `Plume ${numero} retrouvée`);
          button.title = "Cette plume a retrouvé sa place.";

          if (feathersFound.size === featherButtons.length) {
            hintPanel.hidden = true;
            finalFeedback.textContent =
              "Les cinq plumes sont réunies. L'archive oubliée peut enfin s'ouvrir.";
            finalArchiveTrigger.hidden = false;
          } else {
            finalFeedback.textContent =
              `${feathersFound.size} plume${feathersFound.size > 1 ? "s" : ""} sur 5 retrouvée${feathersFound.size > 1 ? "s" : ""}.`;
            showNextHint();
          }
        });
      });
'''

html = html[:pos_debut] + nouveau_js + html[pos_fin:]

# Vérifier le résultat avant d'écrire.
controles = [
    (html.count('data-feather="'), 5, "nombre de plumes"),
    (html.count('id="cie-hunt-hint"'), 1, "panneau d'indices"),
    (html.count("const featherHints = ["), 1, "liste des indices"),
    (html.count('id="modal-cie-final"'), 1, "archive finale"),
    (html.count('data-modal="cie-final"'), 1, "bouton de l'archive"),
]
for obtenu, attendu, nom in controles:
    if obtenu != attendu:
        raise SystemExit(
            f"Vérification échouée : {nom} ({obtenu}, attendu {attendu}). "
            "Aucun fichier écrit."
        )

# Sauvegarde puis écriture.
backup = Path(
    "index.html.sauvegarde-expert-" +
    datetime.now().strftime("%Y%m%d-%H%M%S")
)
shutil.copy2(f, backup)
f.write_text(html, encoding="utf-8")

print("Correctif expert appliqué.")
print("Sauvegarde :", backup)
print("Vérifications réussies : 5 plumes, 5 indices, archive finale.")
