#!/usr/bin/env python3
"""
Ajoute (ou met à jour) le secret « boulder-dash » (↑ ↓ ← → B) du site Lipoip.

Le code se saisit UNIQUEMENT avec les boutons de l'interface « Entrée secrète »
(ouverte en touchant l'étoile au-dessus de Lipoip). Aucun écouteur clavier ou
global n'est ajouté. La saisie en cours est remise à zéro dès que cette
interface se ferme. Le code Konami n'est pas modifié ; son message
« Code incorrect. » est seulement masqué pendant une saisie valide du code
des grottes.

Usage (Termux), depuis le dossier du site :
    python patch_boulder.py                  # patche ./index.html
    python patch_boulder.py chemin/index.html

Le script gère trois situations :
  1. fichier sans le secret            -> ajout complet ;
  2. fichier avec la 1re version       -> retrait de l'ancienne version, puis ajout ;
  3. fichier avec la 2e version        -> mise à jour du bloc de saisie seulement.

Garanties :
- Rien n'est écrit tant que toutes les vérifications ne sont pas passées.
- Sauvegarde horodatée (index.html.bak-AAAAMMJJ-HHMMSS), jamais écrasée.
- Idempotent : relancer le script ne change rien si tout est déjà à jour.
- Aucun push GitHub : tu testes d'abord, puis tu fais commit et push.
"""
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

path = Path(sys.argv[1] if len(sys.argv) > 1 else "index.html")
if not path.is_file():
    sys.exit(f"ERREUR : fichier introuvable : {path}")

with open(path, encoding="utf-8", newline="") as fh:
    html = fh.read()
eol = "\r\n" if "\r\n" in html else "\n"


def nl(text):
    """Adapte les fins de ligne à celles du fichier."""
    return text.replace("\n", eol)


# ---------------------------------------------------------------- vérifications
EXPECTED = [
    'id="modal-code-secret"',        # l'interface ouverte par l'étoile
    'id="star-code-trigger"',        # l'étoile au-dessus de Lipoip
    'data-code-key="b"',             # le bouton B existe déjà
    "const konamiCode",              # le code Konami est présent
    "const secretIds",               # le registre des secrets
    "const titleDefinitions",        # la galerie des titres
    "function markSecret(id)",
]
missing = [m for m in EXPECTED if m not in html]
if missing:
    sys.exit("ERREUR : ce fichier ne ressemble pas au site Lipoip attendu. "
             "Éléments introuvables : " + ", ".join(missing) + ". Rien modifié.")

RESET_ANCHOR = "      // Réinitialisation volontaire de la progression secrète et des titres."

# ------------------------------------------------ textes de la 1re version (v1)
V1_CSS = """
    /* Titre « Survivant des grottes » (secret Boulder Dash) */
    body[data-equipped-title="boulder"] { --purple:#ffb347; --border:rgba(255,179,71,.5); background:radial-gradient(ellipse at 50% 0%,#4a2a12 0%,transparent 55%),#120a05; }
    body[data-equipped-title="boulder"] h1 { color:#ffd9a0; text-shadow:0 0 10px #ff9a2e,0 0 28px #b45a10; }
    body[data-equipped-title="boulder"] .symbol { color:#ffb347; text-shadow:0 0 14px #ff9a2e,0 0 34px #b45a10; }
    body[data-equipped-title="boulder"] .subtitle { color:#ffcf8a; letter-spacing:.15em; }
    body[data-equipped-title="boulder"] header { border-bottom:3px dashed rgba(255,179,71,.55); }
    body[data-equipped-title="boulder"] .equipped-title-badge { color:#ffe2b8; border-color:#ffb347; box-shadow:0 0 18px rgba(255,154,46,.55); }
"""
V1_JS = """      // Code secret « grottes » (Boulder Dash) : ↑ ↓ ← → B.
      // Détecté à tout moment : flèches/touche B du clavier, ou pavé virtuel (déjà présent).
      // Ignoré quand on tape dans un champ de texte, pour éviter les fausses alertes.
      const boulderCode = ["up","down","left","right","b"];
      let boulderBuffer = [];
      function feedBoulderKey(key) {
        boulderBuffer.push(key);
        if (boulderBuffer.length > boulderCode.length) boulderBuffer.shift();
        if (boulderBuffer.length === boulderCode.length && boulderBuffer.every((value, index) => value === boulderCode[index])) {
          boulderBuffer = [];
          markSecret("boulder");
          if (codeFeedback) codeFeedback.textContent = "Code accepté.";
          enteredCode = [];
        }
      }
      document.querySelectorAll("[data-code-key]").forEach(button => button.addEventListener("click", () => feedBoulderKey(button.dataset.codeKey)));
      const boulderKeyMap = { ArrowUp:"up", ArrowDown:"down", ArrowLeft:"left", ArrowRight:"right", b:"b", B:"b" };
      document.addEventListener("keydown", event => {
        if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
        const target = event.target;
        if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
        const key = boulderKeyMap[event.key];
        if (key) feedBoulderKey(key);
      });

"""
V1_TITLE = ('        {id:"boulder",name:"Survivant des grottes",'
            'desc:"Les rochers tombent, mais tu avances : un code des grottes réchauffe tout le site de braise.",'
            'source:"boulder"},\n')

# (texte posé par la v1, texte d'origine)
V1_REVERT = [
    ('"leuzh", "couronne", "konami", "boulder"];', '"leuzh", "couronne", "konami"];'),
    ('<li data-secret-item="konami">Le code venu d’ailleurs</li>'
     '<li data-secret-item="boulder">Le code des grottes</li>',
     '<li data-secret-item="konami">Le code venu d’ailleurs</li>'),
    ('source:"konami"},\n' + V1_TITLE, 'source:"konami"},\n'),
    (V1_CSS + "  </style>", "</style>"),
    (V1_JS + RESET_ANCHOR, RESET_ANCHOR),
]

# ------------------------------------------------------- version actuelle (v3)
CSS = """
    /* Titre « Survivant des grottes » (secret Boulder Dash) */
    body[data-equipped-title="boulder-dash"] { --purple:#ffb347; --border:rgba(255,179,71,.5); background:radial-gradient(ellipse at 50% 0%,#4a2a12 0%,transparent 55%),#120a05; }
    body[data-equipped-title="boulder-dash"] h1 { color:#ffd9a0; text-shadow:0 0 10px #ff9a2e,0 0 28px #b45a10; }
    body[data-equipped-title="boulder-dash"] .symbol { color:#ffb347; text-shadow:0 0 14px #ff9a2e,0 0 34px #b45a10; }
    body[data-equipped-title="boulder-dash"] .subtitle { color:#ffcf8a; letter-spacing:.15em; }
    body[data-equipped-title="boulder-dash"] header { border-bottom:3px dashed rgba(255,179,71,.55); }
    body[data-equipped-title="boulder-dash"] .equipped-title-badge { color:#ffe2b8; border-color:#ffb347; box-shadow:0 0 18px rgba(255,154,46,.55); }
"""

# Bloc de saisie de la 2e version (sans masquage du « Code incorrect. »).
JS_V2 = """      // Code secret « grottes » (Boulder Dash) : ↑ ↓ ← → B.
      // Saisi UNIQUEMENT avec les boutons de l'interface « Entrée secrète » (étoile au-dessus de Lipoip).
      // Aucun écouteur clavier ni global. Indépendant du code Konami, qui n'est pas modifié.
      const boulderCode = ["up", "down", "left", "right", "b"];
      const codeModal = document.getElementById("modal-code-secret");
      let boulderProgress = [];
      if (codeModal) {
        codeModal.querySelectorAll("[data-code-key]").forEach(button => button.addEventListener("click", () => {
          if (!codeModal.classList.contains("is-open")) return;
          const key = button.dataset.codeKey;
          if (key === boulderCode[boulderProgress.length]) boulderProgress.push(key);
          else boulderProgress = key === boulderCode[0] ? [key] : [];
          if (boulderProgress.length === boulderCode.length) {
            boulderProgress = [];
            markSecret("boulder-dash");
            if (codeFeedback) codeFeedback.textContent = "Code accepté.";
          }
        }));
        const boulderReset = document.getElementById("konami-reset");
        if (boulderReset) boulderReset.addEventListener("click", () => { boulderProgress = []; });
        // Fermeture (croix, fond sombre, Échap) ou passage à une autre fenêtre : saisie remise à zéro.
        new MutationObserver(() => {
          if (!codeModal.classList.contains("is-open")) boulderProgress = [];
        }).observe(codeModal, { attributes: true, attributeFilter: ["class"] });
      }

"""

# Bloc de saisie actuel (3e version).
JS = """      // Code secret « grottes » (Boulder Dash) : ↑ ↓ ← → B.
      // Saisi UNIQUEMENT avec les boutons de l'interface « Entrée secrète » (étoile au-dessus de Lipoip).
      // Aucun écouteur clavier ni global. Indépendant du code Konami, qui n'est pas modifié.
      const boulderCode = ["up", "down", "left", "right", "b"];
      const codeModal = document.getElementById("modal-code-secret");
      let boulderProgress = [];
      if (codeModal) {
        codeModal.querySelectorAll("[data-code-key]").forEach(button => button.addEventListener("click", () => {
          if (!codeModal.classList.contains("is-open")) return;
          const key = button.dataset.codeKey;
          if (key === boulderCode[boulderProgress.length]) boulderProgress.push(key);
          else boulderProgress = key === boulderCode[0] ? [key] : [];
          if (boulderProgress.length === boulderCode.length) {
            boulderProgress = [];
            markSecret("boulder-dash");
            if (codeFeedback) codeFeedback.textContent = "Code accepté.";
          } else if (boulderProgress.length > 0 && codeFeedback && codeFeedback.textContent === "Code incorrect.") {
            // Saisie valide du code des grottes en cours : on masque le « Code incorrect. » du Konami.
            codeFeedback.textContent = "";
          }
        }));
        const boulderReset = document.getElementById("konami-reset");
        if (boulderReset) boulderReset.addEventListener("click", () => { boulderProgress = []; });
        // Fermeture (croix, fond sombre, Échap) ou passage à une autre fenêtre : saisie remise à zéro.
        new MutationObserver(() => {
          if (!codeModal.classList.contains("is-open")) boulderProgress = [];
        }).observe(codeModal, { attributes: true, attributeFilter: ["class"] });
      }

"""

# (ancre, remplacement, description) — chaque ancre doit exister exactement une fois.
EDITS = [
    ('"leuzh", "couronne", "konami"];',
     '"leuzh", "couronne", "konami", "boulder-dash"];',
     "liste des secrets (JS)"),
    ('<li data-secret-item="konami">Le code venu d’ailleurs</li>',
     '<li data-secret-item="konami">Le code venu d’ailleurs</li>'
     '<li data-secret-item="boulder-dash">Le code des grottes</li>',
     "registre des secrets (HTML)"),
    ('source:"konami"},\n',
     'source:"konami"},\n'
     '        {id:"boulder-dash",name:"Survivant des grottes",'
     'desc:"Les rochers tombent, mais tu avances : un code des grottes réchauffe tout le site de braise.",'
     'source:"boulder-dash"},\n',
     "galerie des titres"),
    ("</style>", CSS + "  </style>", "style du titre équipé"),
    (RESET_ANCHOR, JS + RESET_ANCHOR, "saisie du code (interface de l'étoile)"),
]

# ------------------------------------------------------------ choix du scénario
new = html
if 'markSecret("boulder-dash")' in html:
    # Scénario 3 : la 2e version est déjà là -> on met seulement le bloc de saisie à jour.
    if nl(JS) in html:
        sys.exit("Le secret « boulder-dash » est déjà présent et à jour : rien à faire.")
    if html.count(nl(JS_V2)) != 1:
        sys.exit("ERREUR : « boulder-dash » est présent mais son bloc de saisie ne "
                 "correspond à aucune version connue (modifié à la main ?). Rien modifié.")
    new = html.replace(nl(JS_V2), nl(JS))
    print("Mise à jour : « Code incorrect. » du Konami masqué pendant une saisie "
          "valide du code des grottes.")
else:
    # Scénario 2 : retrait de la 1re version (clavier global), si présente.
    if "feedBoulderKey" in new:
        for old, orig in V1_REVERT:
            o, r = nl(old), nl(orig)
            count = new.count(o)
            if count != 1:
                sys.exit("ERREUR : ancienne version du patch détectée mais incomplète "
                         "ou modifiée à la main (bloc trouvé %d fois). Rien modifié.\n"
                         "Solution : restaure ton fichier (git checkout -- index.html, "
                         "ou cp de la sauvegarde .bak) puis relance ce script." % count)
            new = new.replace(o, r)
        print("Ancienne version du patch (clavier global) retirée.")
    # Scénarios 1 et 2 : ajout complet.
    for anchor, replacement, label in EDITS:
        a, r = nl(anchor), nl(replacement)
        count = new.count(a)
        if count != 1:
            sys.exit(f"ABANDON ({label}) : point d'insertion trouvé {count} fois au "
                     "lieu de 1. Aucun fichier modifié.")
        new = new.replace(a, r)

# ------------------------------------------------------------- contrôle final
if (new.count('markSecret("boulder-dash")') != 1
        or new.count('source:"boulder-dash"') != 1
        or new.count('data-secret-item="boulder-dash"') != 1
        or "feedBoulderKey" in new
        or new.count(nl(JS)) != 1):
    sys.exit("ABANDON : contrôle final incohérent. Aucun fichier modifié.")

# ------------------------------------------------ vérification de syntaxe (si Node)
node = shutil.which("node")
if node:
    blocks = re.findall(r"<script(?![^>]*src)[^>]*>(.*?)</script>", new, re.S)
    for i, code in enumerate(blocks):
        with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
            f.write(code)
        res = subprocess.run([node, "--check", f.name], capture_output=True, text=True)
        if res.returncode != 0:
            sys.exit(f"ABANDON : erreur de syntaxe JS (bloc {i}) :\n{res.stderr}\nAucun fichier modifié.")
    print("Syntaxe JavaScript : OK")
else:
    print("(Node absent : vérification de syntaxe ignorée. Optionnel : pkg install nodejs)")

# ----------------------------------------------------------------------- écriture
stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = path.with_name(f"{path.name}.bak-{stamp}")
if backup.exists():
    sys.exit(f"ERREUR : la sauvegarde {backup.name} existe déjà. Rien modifié.")
shutil.copy2(path, backup)
with open(path, "w", encoding="utf-8", newline="") as fh:
    fh.write(new)

print(f"OK : {path} mis à jour.")
print(f"Sauvegarde : {backup.name}")
print("Secret « boulder-dash » + titre « Survivant des grottes » à jour.")
print("Rien n'a été envoyé sur GitHub : teste d'abord, puis commit et push.")
