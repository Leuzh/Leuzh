from pathlib import Path
from datetime import datetime
import shutil
import re

f = Path("index.html")
html = f.read_text(encoding="utf-8")

# Retirer les cinq boutons actuels sans toucher aux étoiles.
motif = re.compile(
    r'\s*<button class="cie-feather" type="button" '
    r'data-feather="[1-5]"[^>]*>🪶</button>'
)
html, n = motif.subn("", html)

if n != 5:
    raise SystemExit(
        f"Annulé : {n} plumes trouvées au lieu de 5. "
        "Le fichier n'a pas été modifié."
    )

# Nouveaux emplacements, chacun dans une section différente.
emplacements = [
    (
        "      Bienvenue dans mon petit coin du monde.\n"
        "    </p>",
        1
    ),
    (
        "        <p><em>Je préfère que l'on apprenne à me connaître "
        "page après page.</em></p>",
        2
    ),
    (
        '          <span class="tag">Écriture</span>\n'
        "        </div>",
        3
    ),
    (
        "          Cette galerie sera complétée au fil du temps.\n"
        "        </p>",
        4
    ),
    (
        "          sur mes réseaux sociaux.\n"
        "        </p>",
        5
    ),
]

for ancre, numero in emplacements:
    if html.count(ancre) != 1:
        raise SystemExit(
            f"Annulé : emplacement {numero} introuvable "
            "ou présent plusieurs fois. Aucun fichier écrit."
        )

    bouton = (
        f'\n        <button class="cie-feather" type="button" '
        f'data-feather="{numero}" aria-label="Plume secrète {numero}" '
        f'title="Une plume oubliée" hidden>🪶</button>'
    )
    html = html.replace(ancre, ancre + bouton, 1)

if html.count('data-feather="') != 5:
    raise SystemExit("Vérification échouée. Aucun fichier écrit.")

backup = Path(
    "index.html.sauvegarde-" + datetime.now().strftime("%Y%m%d-%H%M%S")
)
shutil.copy2(f, backup)
f.write_text(html, encoding="utf-8")

print("Les cinq plumes ont été déplacées !")
print("Sauvegarde :", backup)
print("Emplacements : introduction, présentation, passions, album, réseaux.")
