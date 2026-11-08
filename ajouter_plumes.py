from pathlib import Path
from datetime import datetime
import shutil

fichier = Path("index.html")
html = fichier.read_text(encoding="utf-8")

if 'data-feather="' in html:
    print("Les plumes semblent déjà présentes. Aucun changement effectué.")
    raise SystemExit(0)

def remplacer_unique(ancien, nouveau, description):
    global html
    nombre = html.count(ancien)
    if nombre != 1:
        raise RuntimeError(
            f"Modification annulée : {description} "
            f"(ancre trouvée {nombre} fois au lieu d'une)."
        )
    html = html.replace(ancien, nouveau, 1)

# 1. Style des plumes et du bouton final
remplacer_unique(
    "  </style>",
    """
    .cie-feather {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 34px;
      min-height: 34px;
      margin: 8px 5px 0 0;
      padding: 5px;
      border: 1px solid rgba(190,150,255,.28);
      border-radius: 50%;
      color: #e3d0ff;
      background: rgba(125,82,180,.12);
      font-size: 21px;
      cursor: pointer;
      transition: transform .2s ease, box-shadow .2s ease;
    }
    .cie-feather:hover,
    .cie-feather:focus-visible {
      transform: scale(1.12);
      outline: 1px solid #d9c1ff;
    }
    .cie-feather.found {
      box-shadow: 0 0 12px #c5a0ff;
      opacity: .55;
    }
    .cie-feather[hidden],
    .cie-final-trigger[hidden] {
      display: none !important;
    }
    .cie-final-trigger {
      display: inline-flex;
      margin-top: 14px;
      padding: 10px 14px;
      border: 1px solid #c5a0ff;
      border-radius: 10px;
      color: #fff;
      background: #68429a;
      font: inherit;
      cursor: pointer;
    }
  </style>""",
    "CSS des plumes"
)

# 2. Une plume dans chacune des quatre fenêtres, plus une dans le pied de page
etoiles = [
    ('data-star="violet"', "1"),
    ('data-star="blue"', "2"),
    ('data-star="gold"', "3"),
    ('data-star="red"', "4"),
    ('data-star="white"', "5"),
]

for etoile, numero in etoiles:
    debut = html.count(f'<button class="cie-star" type="button" {etoile}')
    if debut != 1:
        raise RuntimeError(
            f"Modification annulée : étoile {etoile} trouvée {debut} fois."
        )
    position = html.index(f'<button class="cie-star" type="button" {etoile}')
    fin = html.index("</button>", position) + len("</button>")
    bouton = html[position:fin]
    plume = (
        f'\n        <button class="cie-feather" type="button" '
        f'data-feather="{numero}" aria-label="Plume secrète {numero}" '
        f'title="Une plume oubliée" hidden>🪶</button>'
    )
    html = html[:fin] + plume + html[fin:]

# 3. Bouton de l'archive finale, caché au départ
remplacer_unique(
    '            <p id="cie-final-feedback" class="cie-feedback" aria-live="polite"></p>',
    '''            <p id="cie-final-feedback" class="cie-feedback" aria-live="polite"></p>
            <button class="cie-final-trigger" type="button"
              data-modal="cie-final" hidden>
              ✧ Ouvrir l'archive oubliée
            </button>''',
    "bouton de l'archive finale"
)

# 4. Nouvelle fenêtre secrète
remplacer_unique(
    '  <footer>',
    '''  <!-- Archive finale de la CIE -->
  <div class="modal" id="modal-cie-final" role="dialog"
    aria-modal="true" aria-labelledby="title-cie-final" aria-hidden="true">
    <section class="modal-window">
      <div class="modal-header">
        <h2 class="modal-title" id="title-cie-final">🪶 L'archive oubliée</h2>
        <button class="close-modal" type="button" aria-label="Fermer la fenêtre">×</button>
      </div>
      <div class="modal-content">
        <p><strong>Les cinq plumes ont retrouvé leur place.</strong></p>
        <p>
          Tu as suivi les étoiles, déchiffré les mots et retrouvé
          les traces laissées entre les pages.
        </p>
        <p>
          Certaines archives ne gardent pas des secrets.
          Elles gardent la trace de ceux qui ont pris le temps
          de les chercher.
        </p>
        <p><em>« Tout ne se révèle pas au premier regard. »</em></p>
        <p>✧ Fin de l'archive. Ou début d'une autre ? ✧</p>
      </div>
    </section>
  </div>

  <footer>''',
    "fenêtre de l'archive finale"
)

# 5. Déverrouillage et collecte des plumes
remplacer_unique(
    "    })();",
    r'''
      // Chasse aux plumes, débloquée après la deuxième énigme.
      const featherAnswerForm = document.getElementById("cie-final-form");
      const featherButtons = [...document.querySelectorAll("[data-feather]")];
      const finalArchiveTrigger = document.querySelector(".cie-final-trigger");
      const featherFeedback = document.getElementById("cie-final-feedback");
      let feathersUnlocked = false;
      const feathersFound = new Set();

      if (featherAnswerForm) {
        featherAnswerForm.addEventListener("submit", () => {
          const answer = (document.getElementById("cie-final-answer").value || "")
            .trim().toLocaleLowerCase("fr-FR").normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

          const accepted = [
            "un livre", "livre", "le livre", "une histoire",
            "histoire", "un texte", "texte", "l'ecriture", "ecriture"
          ];

          if (accepted.includes(answer)) {
            feathersUnlocked = true;
            featherButtons.forEach(button => {
              button.hidden = false;
            });
            featherFeedback.textContent =
              "La serrure s'ouvre. Cinq plumes sont cachées dans les fenêtres du site. Retrouve-les toutes.";
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
          button.textContent = "✓";
          button.setAttribute("aria-label", `Plume ${numero} retrouvée`);

          const total = feathersFound.size;
          if (total === featherButtons.length) {
            featherFeedback.textContent =
              "Les cinq plumes sont réunies. L'archive oubliée est désormais accessible.";
            finalArchiveTrigger.hidden = false;
          } else {
            featherFeedback.textContent =
              `${total} plume${total > 1 ? "s" : ""} sur 5 retrouvée${total > 1 ? "s" : ""}.`;
          }
        });
      });
    })();''',
    "logique JavaScript des plumes"
)

# Vérifications avant d'écrire le fichier
if html.count('data-feather="') != 5:
    raise RuntimeError("Vérification échouée : il ne reste pas exactement cinq plumes.")
if 'id="modal-cie-final"' not in html:
    raise RuntimeError("La fenêtre finale est absente.")
if 'data-modal="cie-final"' not in html:
    raise RuntimeError("Le bouton final est absent.")

sauvegarde = Path(
    "index.html.sauvegarde-" + datetime.now().strftime("%Y%m%d-%H%M%S")
)
shutil.copy2(fichier, sauvegarde)
fichier.write_text(html, encoding="utf-8")

print("Correctif appliqué avec succès !")
print(f"Sauvegarde originale : {sauvegarde}")
print("Vérification : cinq plumes et archive finale présentes.")
