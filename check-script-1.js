
    (() => {
      const modalLinks = document.querySelectorAll("[data-modal]");
      const modals = document.querySelectorAll(".modal");
      let activeModal = null;
      let previousFocus = null;

      function openModal(name) {
        const modal = document.getElementById(`modal-${name}`);
        if (!modal) return;

        if (activeModal && activeModal !== modal) {
          activeModal.classList.remove("is-open");
          activeModal.setAttribute("aria-hidden", "true");
        } else if (!activeModal) {
          previousFocus = document.activeElement;
        }
        activeModal = modal;
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");

        const closeButton = modal.querySelector(".close-modal");
        if (closeButton) closeButton.focus();

        // Replace la fenêtre au début de son contenu à chaque ouverture.
        const content = modal.querySelector(".modal-content");
        if (content) content.scrollTop = 0;
      }

      function closeModal() {
        if (!activeModal) return;

        activeModal.classList.remove("is-open");
        activeModal.setAttribute("aria-hidden", "true");
        activeModal = null;
        document.body.classList.remove("modal-open");

        if (previousFocus && typeof previousFocus.focus === "function") {
          previousFocus.focus();
        }
      }

      // Registre des secrets : chaque découverte est conservée sur cet appareil.
      const secretIds = ["cie-livre", "cie-etoiles", "cie-gardien", "cie-plumes", "cie-archive", "folie", "aria", "lipoip", "leuzh", "couronne", "konami"];
      const secretStorageKey = "lipoip-secret-registry-v1";
      let discoveredSecrets = new Set();
      try { discoveredSecrets = new Set(JSON.parse(localStorage.getItem(secretStorageKey) || "[]")); } catch (_) {}
      function markSecret(id) {
        if (!secretIds.includes(id)) return;
        discoveredSecrets.add(id);
        try { localStorage.setItem(secretStorageKey, JSON.stringify([...discoveredSecrets])); } catch (_) {}
        updateSecretRegistry();
        renderTitleCollection();
      }

      // Easter egg sans indice : séquence Konami saisie avec les touches à l’écran.
      const konamiCode = ["up","up","down","down","left","right","left","right","b","a"];
      let enteredCode = [];
      const codeFeedback = document.getElementById("konami-feedback");
      document.querySelectorAll("[data-code-key]").forEach(button => button.addEventListener("click", () => {
        const key = button.dataset.codeKey;
        enteredCode.push(key);
        if (enteredCode.length > konamiCode.length) enteredCode.shift();
        if (enteredCode.length === konamiCode.length && enteredCode.every((value, index) => value === konamiCode[index])) {
          markSecret("konami");
          if (codeFeedback) codeFeedback.textContent = "Code accepté.";
          enteredCode = [];
        } else if (codeFeedback) {
          const matches = enteredCode.every((value, index) => value === konamiCode[index]);
          codeFeedback.textContent = matches ? `${enteredCode.length} / ${konamiCode.length}` : "Code incorrect.";
          if (!matches) enteredCode = [];
        }
      }));
      document.getElementById("konami-reset")?.addEventListener("click", () => {
        enteredCode = [];
        if (codeFeedback) codeFeedback.textContent = "";
      });

      // Réinitialisation volontaire de la progression secrète et des titres.
      const resetProgressButton = document.getElementById("reset-all-progress");
      if (resetProgressButton) resetProgressButton.addEventListener("click", () => {
        const accepted = window.confirm("Réinitialiser tous les secrets, les titres débloqués et le titre équipé sur cet appareil ? Cette action est irréversible.");
        if (!accepted) return;
        const keysToReset = [
          secretStorageKey, "lipoip-equipped-title-v1", "lipoip-seven-symbols-v2",
          "lipoip-couronne-stage-v2", "lipoip-origin-lipoip-v1", "lipoip-origin-leuzh-v1",
          "lipoip-folie-unlocked", "lipoip-cat-secret-v1", "lipoip-cat-unlocked-v1"
        ];
        keysToReset.forEach(key => { try { localStorage.removeItem(key); } catch (_) {} });
        // Retire aussi les anciennes clés de la chasse CIE/album pour repartir proprement.
        try { Object.keys(localStorage).filter(key => /lipoip.*(clue|star|feather|cat|secret|origin|folie|couronne|title)/i.test(key)).forEach(key => localStorage.removeItem(key)); } catch (_) {}
        window.location.reload();
      });
      const titleDefinitions = [
        {id:"chercheur",name:"Chercheur de l'invisible",desc:"L’accueil souligne ton nom et encadre le message de bienvenue.",source:"folie"},
        {id:"scribe",name:"Scribe des origines",desc:"Le nom et le symbole prennent une signature dorée.",source:"lipoip"},
        {id:"leuzh",name:"Héritier de la Confrérie",desc:"Le sous-titre se déploie avec une ligne qui rappelle la marque de la Confrérie.",source:"leuzh"},
        {id:"etoiles",name:"Cartographe des étoiles",desc:"Pour avoir réuni la constellation de la CIE.",source:"cie-etoiles"},
        {id:"plumes",name:"Messager des cinq plumes",desc:"Le symbole grandit et le bas de l’en-tête se pare de marques de plumes.",source:"cie-plumes"},
        {id:"aria",name:"Ami d'Aria",desc:"Pour avoir découvert le secret de l'album d'Aria.",source:"aria"},
        {id:"couronne",name:"Tisseur d'indices",desc:"Pour avoir résolu les trois épreuves de la Couronne oubliée.",source:"couronne"},
        {id:"konami",name:"Héritier du code oublié",desc:"Un code sans indice transforme entièrement l’apparence du site.",source:"konami"},
        {id:"complet",name:"L'Âme de l'Univers",desc:"Titre ultime : découvre tous les secrets actuellement définis. Si de nouveaux secrets sont ajoutés, il se verrouille de nouveau jusqu’à leur découverte. Une fois équipé, il transforme l’ambiance entière du site.",source:"__all__"}
      ];
      let equippedTitle = "";
      try { equippedTitle = localStorage.getItem("lipoip-equipped-title-v1") || ""; } catch (_) {}
      function renderTitleCollection() {
        const list=document.getElementById("title-collection-list"), progress=document.getElementById("title-collection-progress"), badge=document.getElementById("equipped-title-badge");
        const hasAllSecrets=secretIds.every(id=>discoveredSecrets.has(id));
        const isUnlocked=t=>t.source==="__all__" ? hasAllSecrets : discoveredSecrets.has(t.source);
        const equipped=titleDefinitions.find(t=>t.id===equippedTitle && isUnlocked(t));
        document.body.dataset.equippedTitle=equipped ? equipped.id : "";
        if(badge){badge.hidden=!equipped;badge.textContent=equipped ? `✧ ${equipped.name} ✧` : "";}
        const count=titleDefinitions.filter(isUnlocked).length;
        if(progress) progress.textContent=`${count} titre${count===1?"":"s"} débloqué${count===1?"":"s"} sur ${titleDefinitions.length}.`;
        if(!list)return; list.innerHTML="";
        titleDefinitions.forEach(t=>{
          const unlocked=isUnlocked(t), card=document.createElement("li"); card.className="title-card"+(unlocked?"":" is-locked");
          const h=document.createElement("h3"); h.textContent=unlocked?`✧ ${t.name}`:"Titre verrouillé";
          const d=document.createElement("p"); d.textContent=unlocked?t.desc:"Termine la quête associée pour le découvrir.";
          const b=document.createElement("button"); b.type="button"; b.textContent=!unlocked?"Non débloqué":(equippedTitle===t.id?"Déséquiper ce titre ✓":"Équiper ce titre"); b.disabled=!unlocked;
          b.addEventListener("click",()=>{equippedTitle=equippedTitle===t.id?"":t.id;try{if(equippedTitle)localStorage.setItem("lipoip-equipped-title-v1",equippedTitle);else localStorage.removeItem("lipoip-equipped-title-v1");}catch(_){}renderTitleCollection();});
          card.append(h,d,b);list.appendChild(card);
        });
      }

      function updateSecretRegistry() {
        const count = secretIds.filter(id => discoveredSecrets.has(id)).length;
        const percent = Math.round(count / secretIds.length * 100);
        const countNode = document.getElementById("secret-count");
        const percentNode = document.getElementById("secret-percent");
        const bar = document.getElementById("secret-progress-bar");
        const complete = document.getElementById("secret-complete-message");
        if (countNode) countNode.textContent = `${count} secret${count === 1 ? "" : "s"} découvert${count === 1 ? "" : "s"} sur ${secretIds.length}.`;
        if (percentNode) percentNode.innerHTML = `<strong>${percent} %</strong> exploré`;
        if (bar) bar.style.width = `${percent}%`;
        if (complete) complete.hidden = count !== secretIds.length;
        document.querySelectorAll("[data-secret-item]").forEach(item => {
          const found = discoveredSecrets.has(item.dataset.secretItem);
          // Masque le nom des secrets tant qu'ils ne sont pas découverts.
          item.hidden = !found;
          item.style.opacity = "1";
          item.style.listStyleType = "'✦  '";
          const status = item.querySelector("small");
          if (status) status.remove();
        });
      }
      updateSecretRegistry();
      renderTitleCollection();
      // Réconcilie les découvertes déjà sauvegardées dans les anciennes énigmes.
      try { if (localStorage.getItem("lipoip-folie-unlocked") === "1") markSecret("folie"); } catch (_) {}

      const originLipoipForm = document.getElementById("origin-lipoip-form");
      const originLeuzhForm = document.getElementById("origin-leuzh-form");
      const originLipoipReward = document.getElementById("origin-lipoip-reward");
      const originLeuzhBlock = document.getElementById("origin-leuzh-block");
      const originLeuzhReward = document.getElementById("origin-leuzh-reward");
      try {
        if (localStorage.getItem("lipoip-origin-lipoip-v1") === "1") { originLipoipReward.hidden = false; originLeuzhBlock.hidden = false; }
        if (localStorage.getItem("lipoip-origin-leuzh-v1") === "1") originLeuzhReward.hidden = false;
      } catch (_) {}
      function normalizeAnswer(value) { return (value || "").trim().toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’']/g, "").replace(/\s+/g, " "); }
      if (originLipoipForm) originLipoipForm.addEventListener("submit", event => {
        event.preventDefault();
        const answer = normalizeAnswer(document.getElementById("origin-lipoip-answer").value);
        const feedback = document.getElementById("origin-lipoip-feedback");
        if (["lipoip", "le lipoip"].includes(answer)) {
          feedback.textContent = "La première histoire se révèle. La seconde énigme est maintenant accessible.";
          originLipoipReward.hidden = false; originLeuzhBlock.hidden = false;
          try { localStorage.setItem("lipoip-origin-lipoip-v1", "1"); } catch (_) {}
          markSecret("lipoip");
        } else feedback.textContent = "Ce nom est né d'une erreur de lettres. Essaie encore.";
      });
      if (originLeuzhForm) originLeuzhForm.addEventListener("submit", event => {
        event.preventDefault();
        const answer = normalizeAnswer(document.getElementById("origin-leuzh-answer").value);
        const feedback = document.getElementById("origin-leuzh-feedback");
        if (["leuzh", "le leuzh"].includes(answer)) {
          feedback.textContent = "La marque de la confrérie a retrouvé son origine.";
          originLeuzhReward.hidden = false;
          try { localStorage.setItem("lipoip-origin-leuzh-v1", "1"); } catch (_) {}
          markSecret("leuzh");
        } else feedback.textContent = "Relis l'indice sur la marque partagée par les membres.";
      });

      // Énigme de niveau 1 : la récompense reste débloquée sur cet appareil.
      const folieReward = document.getElementById("folie-reward");
      const folieFeedback = document.getElementById("folie-feedback");
      const folieOptions = document.querySelectorAll("[data-folie-answer]");
      const folieUnlocked = () => {
        try { return localStorage.getItem("lipoip-folie-unlocked") === "1"; }
        catch (error) { return false; }
      };
      function syncFolieState() {
        if (folieUnlocked()) {
          folieReward.hidden = false;
          folieFeedback.hidden = true;
          folieOptions.forEach(option => option.hidden = true);
          markSecret("folie");
        }
      }
      folieOptions.forEach(option => {
        option.addEventListener("click", () => {
          if (option.dataset.folieAnswer === "folie") {
            try { localStorage.setItem("lipoip-folie-unlocked", "1"); } catch (error) {}
            folieFeedback.hidden = true;
            folieReward.hidden = false;
            folieOptions.forEach(item => item.hidden = true);
            markSecret("folie");
          } else {
            folieFeedback.textContent = "Pas tout à fait ! Cherche ce qui peut surgir spontanément et rendre l'instant inattendu. 😉";
            folieFeedback.hidden = false;
          }
        });
      });
      syncFolieState();

      modalLinks.forEach(link => {
        link.addEventListener("click", event => {
          event.preventDefault();
          openModal(link.dataset.modal);
          if (link.dataset.modal === "cie-archive") markSecret("cie-archive");
        });
      });

      modals.forEach(modal => {
        const closeButton = modal.querySelector(".close-modal");
        if (closeButton) closeButton.addEventListener("click", closeModal);

        // Ferme seulement si l'utilisateur clique sur le fond sombre.
        modal.addEventListener("click", event => {
          if (event.target === modal) closeModal();
        });
      });

      document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeModal();
      });

      // Petite énigme locale de la CIE : aucune donnée n'est envoyée ni enregistrée.
      const riddleForm = document.getElementById("cie-riddle-form");
      if (riddleForm) {
        riddleForm.addEventListener("submit", event => {
          event.preventDefault();
          const answer = (document.getElementById("cie-answer").value || "")
            .trim().toLocaleLowerCase("fr-FR").normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
          const feedback = document.getElementById("cie-feedback");
          const reveal = document.getElementById("cie-reveal");
          if (["livre", "un livre", "le livre"].includes(answer)) {
            feedback.textContent = "La serrure cède. Une archive s'ouvre…";
            reveal.hidden = false;
            markSecret("cie-livre");
          } else {
            feedback.textContent = "La serrure reste close. Relis l'énigme et cherche ce qui conserve les pensées.";
            reveal.hidden = true;
          }
        });
      }

      // Chasse aux cinq étoiles : bleue, violette, dorée, rouge, blanche.
      const starOrder = ["blue", "violet", "gold", "red", "white"];
      const starButtons = [...document.querySelectorAll("[data-star]")];
      const starFeedback = document.getElementById("cie-star-feedback");
      const finalRiddle = document.getElementById("cie-final-riddle");
      let starProgress = 0;
      let starsUnlocked = false;

      function unlockStars() {
        starsUnlocked = true;
        starButtons.forEach(button => { button.hidden = false; button.disabled = false; });
      }

      starButtons.forEach(button => {
        button.addEventListener("click", () => {
          if (!starsUnlocked || document.getElementById("cie-reveal").hidden) return;
          const chosen = button.dataset.star;
          if (chosen === starOrder[starProgress]) {
            button.classList.add("found");
            button.disabled = true;
            const step = document.getElementById(`cie-step-${starProgress + 1}`);
            if (step) step.textContent = "✦";
            starProgress += 1;
            if (starProgress === starOrder.length) {
              starFeedback.textContent = "La constellation est complète. Une seconde archive s'ouvre…";
              finalRiddle.hidden = false;
              markSecret("cie-etoiles");
            } else {
              starFeedback.textContent = `Bon éclat ! ${starProgress} étoile${starProgress > 1 ? 's' : ''} sur 5 retrouvée${starProgress > 1 ? 's' : ''}.`;
            }
          } else {
            starProgress = 0;
            starButtons.forEach(item => { item.classList.remove("found"); item.disabled = false; });
            for (let i = 1; i <= 5; i++) {
              const step = document.getElementById(`cie-step-${i}`);
              if (step) step.textContent = "☆";
            }
            starFeedback.textContent = "L'ordre est brisé. Relis l'énigme et recommence depuis la première étoile.";
          }
        });
      });

      const finalForm = document.getElementById("cie-final-form");
      if (finalForm) {
        finalForm.addEventListener("submit", event => {
          event.preventDefault();
          const answer = (document.getElementById("cie-final-answer").value || "")
            .trim().toLocaleLowerCase("fr-FR").normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
          const feedback = document.getElementById("cie-final-feedback");
          if (["un livre", "livre", "le livre", "une histoire", "histoire", "un texte", "texte", "l'ecriture", "ecriture", "l'écriture"].includes(answer)) {
            feedback.textContent = "La seconde serrure s'ouvre : les mots peuvent voyager plus loin que leur auteur. Quelque chose de léger s'est dispersé dans le site…";
            unlockFeathers();
            markSecret("cie-gardien");
          } else {
            feedback.textContent = "La porte reste close. Pense à ce qui voyage à travers les siècles et change selon celui qui le découvre.";
          }
        });
      }

 // Les plumes n'apparaissent qu'après la résolution de la deuxième énigme.
      const featherButtons = [...document.querySelectorAll("[data-feather]")];
      const featherHunt = document.getElementById("cie-feather-hunt");
      const featherFeedback = document.getElementById("cie-feather-feedback");
      const finalButton = document.getElementById("cie-final-button");
      const foundFeathers = new Set();

      const featherHint = document.getElementById("cie-feather-hint");
      const featherHints = {
        "1": "Indice : une valeur se cache dans la façon de raconter la curiosité.",
        "2": "Indice : parmi les étiquettes des passions, l'écriture a une petite marge secrète.",
        "3": "Indice : dans l'album, observe les bords d'une image plutôt que son sujet.",
        "4": "Indice : près des portes qui mènent vers les réseaux, un détail attend.",
        "5": "Indice : le dernier fragment veille tout en bas de la page."
      };

      function updateFeatherHint() {
        const next = ["1", "2", "3", "4", "5"].find(id => !foundFeathers.has(id));
        if (featherHint) {
          featherHint.textContent = next ? featherHints[next] : "Tous les fragments sont réunis. La dernière archive t'attend.";
        }
      }

      function unlockFeathers() {
        featherHunt.hidden = false;
        featherButtons.forEach(button => { button.hidden = false; });
        featherFeedback.textContent = "0 plume sur 5 retrouvée.";
        updateFeatherHint();
      }

      featherButtons.forEach(button => {
        button.addEventListener("click", () => {
          if (button.hidden || foundFeathers.has(button.dataset.feather)) return;
          foundFeathers.add(button.dataset.feather);
          button.classList.add("found");
          button.disabled = true;
          button.setAttribute("aria-label", "Plume retrouvée");
          featherFeedback.textContent = `${foundFeathers.size} plume${foundFeathers.size > 1 ? "s" : ""} sur 5 retrouvée${foundFeathers.size > 1 ? "s" : ""}.`;
          updateFeatherHint();
          if (foundFeathers.size === featherButtons.length) {
            featherFeedback.textContent = "Les cinq plumes sont réunies. La dernière archive est maintenant accessible.";
            finalButton.hidden = false;
            markSecret("cie-plumes");
          }
        });
      });

      // L'accès à la chasse reste fermé tant que la première énigme n'est pas résolue.
      // Chasse indépendante aux sept symboles : ordre libre, sauvegarde locale.
      const clueButtons = [...document.querySelectorAll("[data-clue]")];
      const catForm = document.getElementById("lipoip-cat-riddle-form");
      const catFeedback = document.getElementById("lipoip-cat-feedback");
      const catSuccess = document.getElementById("lipoip-cat-success");
      // Cette chasse recommence à zéro à chaque actualisation, sans modifier la CIE.
      const clueStorageKey = "lipoip-seven-symbols-v2";
      const catStorageKey = "lipoip-cat-secret-v1";
      let foundClues = new Set();
      try { foundClues = new Set(JSON.parse(localStorage.getItem(clueStorageKey) || "[]")); } catch (_) {}

      function refreshClueProgress() {
        const albumQuestButton = document.getElementById("open-album-quest");
        if (albumQuestButton) albumQuestButton.hidden = foundClues.size < 7;
        clueButtons.forEach(button => {
          const id = button.dataset.clue;
          const found = foundClues.has(id);
          button.classList.toggle("found", found);
          button.setAttribute("aria-pressed", String(found));
          const note = document.getElementById(`clue-note-${id}`);
          if (note && !found) note.classList.remove("is-visible");
        });
      }

      clueButtons.forEach(button => {
        button.addEventListener("click", () => {
          const id = button.dataset.clue;
          const note = document.getElementById(`clue-note-${id}`);
          if (!foundClues.has(id)) {
            foundClues.add(id);
            try { localStorage.setItem(clueStorageKey, JSON.stringify([...foundClues])); } catch (_) {}
            refreshClueProgress();
          }
          // Un second toucher masque l'indice, sans oublier le symbole trouvé.
          if (note) note.classList.toggle("is-visible");
        });
      });
      refreshClueProgress();
      try { if (localStorage.getItem(catStorageKey) === "1" && catSuccess) catSuccess.hidden = false; } catch (_) {}

      if (catForm) {
        catForm.addEventListener("submit", event => {
          event.preventDefault();
          const answer = (document.getElementById("lipoip-cat-answer").value || "")
            .trim().toLocaleLowerCase("fr-FR").normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
          if (["chat", "un chat", "le chat"].includes(answer)) {
            if (catFeedback) catFeedback.textContent = "La serrure s'ouvre. Le secret est à toi.";
            if (catSuccess) catSuccess.hidden = false;
            markSecret("aria");
            try { localStorage.setItem(catStorageKey, "1"); } catch (_) {}
          } else {
            if (catFeedback) catFeedback.textContent = "La serrure reste close. Relis les fragments et la piste réunie.";
            if (catSuccess) catSuccess.hidden = true;
          }
        });
      }


      if (riddleForm) {
        riddleForm.addEventListener("submit", () => {
          const answer = (document.getElementById("cie-answer").value || "")
            .trim().toLocaleLowerCase("fr-FR").normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
          if (["livre", "un livre", "le livre"].includes(answer)) unlockStars();
        });
      }

      // Bouton qui active ou désactive la surbrillance du message d'accueil.
      const highlightButton = document.getElementById("highlight-button");
      const welcomeHighlight = document.getElementById("welcome-highlight");

      if (highlightButton && welcomeHighlight) {
        highlightButton.addEventListener("click", () => {
          const highlighted = welcomeHighlight.classList.toggle("is-highlighted");
          highlightButton.setAttribute("aria-pressed", String(highlighted));
          highlightButton.textContent = highlighted
            ? "✧ Éteindre l'éclat"
            : "✧ Faire briller mon univers";
        });
      }

      // Entrée discrète : faire briller l'accueil, puis cliquer sur son message.
      // Chasse indépendante : La Couronne oubliée.
      const crownKey = "lipoip-couronne-stage-v2";
      const crownStages = ["crown-stage-1", "crown-stage-2", "crown-stage-3"];
      let crownStage = 0;
      let crownCombination = [];
      try { crownStage = Math.max(0, Math.min(3, Number(localStorage.getItem(crownKey) || 0))); } catch (_) {}
      function saveCrownStage() { try { localStorage.setItem(crownKey, String(crownStage)); } catch (_) {} }
      function updateCrownProgress() {
        const bar = document.getElementById("crown-progress-bar");
        const label = document.getElementById("crown-progress-text");
        if (bar) bar.style.width = `${Math.min(crownStage, 3) / 3 * 100}%`;
        if (label) label.textContent = crownStage >= 3 ? "Les trois épreuves sont accomplies." : `Épreuve ${crownStage + 1} sur 3`;
        crownStages.forEach((id, i) => { const node = document.getElementById(id); if (node) node.hidden = i !== crownStage; });
        const final = document.getElementById("crown-final"); if (final) final.hidden = crownStage < 3;
      }
      function openCrownHunt() { openModal("couronne"); updateCrownProgress(); }
      function enterCrownHunt() {
        if (!welcomeHighlight || !welcomeHighlight.classList.contains("is-highlighted")) return;
        openCrownHunt();
      }
      if (welcomeHighlight) {
        welcomeHighlight.addEventListener("click", enterCrownHunt);
        welcomeHighlight.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); enterCrownHunt(); } });
      }
      const crownHints = {
        "1": "Les écarts entre les lettres augmentent d'une unité à chaque fois. Convertis les lettres en positions dans l'alphabet.",
        "2": "Teste les trois coffres. Pour chaque choix, écris V ou F à côté des trois déclarations et compte les vérités.",
        "3": "L'étoile doit être juste après la lune. La plume ne peut pas être première et doit toucher l'étoile."
      };
      document.querySelectorAll("[data-crown-hint]").forEach(button => button.addEventListener("click", () => {
        const target = document.getElementById("crown-hint-" + button.dataset.crownHint);
        if (target) target.textContent = crownHints[button.dataset.crownHint] || "";
      }));
      const crownSubmit1 = document.getElementById("crown-submit-1");
      if (crownSubmit1) crownSubmit1.addEventListener("click", () => {
        const value = (document.getElementById("crown-answer-1").value || "").trim().toUpperCase();
        const feedback = document.getElementById("crown-feedback-1");
        if (value === "U") { crownStage = 1; saveCrownStage(); updateCrownProgress(); }
        else if (feedback) feedback.textContent = "Pas encore. Regarde les écarts : +2, puis +3, puis +4…";
      });
      // Une seule déclaration vraie : le coffre de verre satisfait A=F, B=V, C=V (deux vraies), donc impossible;
      // le coffre d'argent donne V,V,F (deux vraies); le coffre de bois donne F,F,V (une vraie).
      document.querySelectorAll("[data-crown-chest]").forEach(button => button.addEventListener("click", () => {
        const feedback = document.getElementById("crown-feedback-2");
        if (button.dataset.crownChest === "wood") { crownStage = 2; saveCrownStage(); updateCrownProgress(); }
        else if (feedback) feedback.textContent = "Cette hypothèse ne respecte pas la règle d'une seule phrase vraie. Recompte les trois déclarations.";
      }));
      const crownOrder = ["moon", "star", "feather"];
      const labels = {star:"✦", moon:"☾", feather:"🪶"};
      function renderCrownCombination() {
        const combo = document.getElementById("crown-combination");
        if (combo) combo.textContent = crownCombination.map(x => labels[x]).join(" → ") || "aucun symbole";
      }
      document.querySelectorAll("[data-crown-symbol]").forEach(button => button.addEventListener("click", () => {
        if (crownStage !== 2) return;
        if (crownCombination.length >= 3) crownCombination = [];
        crownCombination.push(button.dataset.crownSymbol); renderCrownCombination();
        if (crownCombination.length === 3) {
          const feedback = document.getElementById("crown-feedback-3");
          if (crownCombination.every((value, index) => value === crownOrder[index])) {
            crownStage = 3; saveCrownStage(); updateCrownProgress(); markSecret("couronne");
          } else {
            if (feedback) feedback.textContent = "La serrure refuse cette combinaison. Les trois inscriptions doivent être vraies en même temps.";
            crownCombination = []; renderCrownCombination();
          }
        }
      }));
      const crownReset = document.getElementById("crown-reset-lock");
      if (crownReset) crownReset.addEventListener("click", () => {
        crownCombination = []; renderCrownCombination();
        const feedback = document.getElementById("crown-feedback-3"); if (feedback) feedback.textContent = "Combinaison effacée.";
      });
      if (crownStage >= 3) { const status = document.getElementById("crown-final-status"); if (status) status.textContent = "Ta découverte est déjà enregistrée sur cet appareil."; }
      updateCrownProgress();
    })();
  