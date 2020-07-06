/**
 * Adapted for PF1 system from original module: https://github.com/jopeek/fvtt-loot-sheet-npc-5e
 */
let tempfunc = console.log;
class GenerateCompendiumDialog extends Dialog {
  constructor(callback, options) {
    if (typeof options !== "object") {
      options = {};
    }

    let applyChanges = false;
    super({
      title: game.i18n.localize("tb.generateCompendiumTitle"),
      content: options.html,
      buttons: {
        generate: {
          label: game.i18n.localize("tb.generate"),
          dontclose: true,
          callback: (html) => this._generate(html),
        },
        cancel: {
          label: game.i18n.localize("tb.cancel"),
        },
      },
      default: "generate",
      close: (dialog) => {
        console.log(dialog);
      },
    });
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Detect and activate file-picker buttons
    html
      .find("button.file-picker")
      .each((i, button) => this._activateFilePicker(button));
  }

  _activateFilePicker(button) {
    button.onclick = (event) => {
      event.preventDefault();
      FilePicker.fromButton(button).browse();
    };
  }

  _submit(button, html) {
    try {
      if (button.callback) button.callback(html);
      if (!button.dontclose) this.close();
    } catch (err) {
      ui.notifications.error(err);
      throw new Error(err);
    }
  }

  async _generate(html) {
    let source = html.find('input[name="source"]').val();
    let template = html.find('input[name="template"]').val();
    let entity = html.find('select[name="entity"]').val();
    console.log = () => {};

    if (entity != "Actor" && entity != "Item") {
      ui.notifications.error(game.i18n.localize("ERROR.tbInvalidEntity"));
      return;
    }

    if (source.length == 0) {
      ui.notifications.error(game.i18n.localize("ERROR.tbNoSource"));
    } else if (template.length == 0) {
      ui.notifications.error(game.i18n.localize("ERROR.tbNoTemplate"));
    } else {
      game.settings.set("auto-sbc-toolbox", "source", source);
      game.settings.set("auto-sbc-toolbox", "template", template);
      game.settings.set("auto-sbc-toolbox", "entity", entity);

      // load data (as CSV)
      let data;
      try {
        data = await d3.csv(source);
      } catch (err) {
        ui.notifications.error(game.i18n.localize("ERROR.tbInvalidCSV"));
        throw new Error(err);
      }

      // load template (as text)
      const tmpl = await d3.text(template);
      //console.log(tmpl)

      // valide CSV based on template
      let fields = new Set();
      let matches = tmpl.matchAll(/\{\{([^\}]+)\}\}/g);
      matches = Array.from(matches);
      matches.forEach((m) => fields.add(m[1]));
      let fieldIsNumber = {};
      let fieldDefault = {};
      let hasSample = false;
      //       for (let i=0; i<data.length; i++) {

      //         // let sample = i > 0 ? false : data[0][fields.values().next().value] === "sample"
      //         // for (let f of fields.keys()) {
      //         //   if (f in fieldIsNumber) {
      //         //     // text mixed with numbers
      //         //     if (fieldIsNumber[f] && isNaN(data[i][f])) {
      //         //       ui.notifications.error(game.i18n.format("ERROR.tbNumberMixedWithText", {row: i+1, field: f}));
      //         //       let field = Object.keys(data[i]).indexOf(f)
      //         //       let f1Char = Math.floor(field / 26) == 0 ? "" : String.fromCharCode(65 + n)
      //         //       let f2Char = String.fromCharCode(65 + (field % 26))
      //         //       console.log(`Text found where Number should be: '${data[i][f]}' for field '${f}' (${f1Char}${f2Char}) on row ${i+2}`)
      //         //       console.log("If column number doesn't match your file, it means that you have 2 columns with the same name (one got ignored)")
      //         //       return;
      //         //     }
      //         //     // numbers but with text
      //         //   } else if(data[i][f] != null && data[i][f].length > 0) {
      //         //     fieldIsNumber[f] = !isNaN(data[i][f])
      //         //   }
      //         //   if (sample) {
      //         //     hasSample = true
      //         //     fieldDefault[f] = isNaN(data[i][f]) ? data[i][f] : Number(data[i][f])
      //         //   }
      //         // }
      //       }

      const totalCount = hasSample ? data.length - 1 : data.length;

      // delete compendium if exists
      let compendium = game.packs.get("world.toolbox-data");
      if (compendium) {
        await compendium.delete();
      }

      // create new compendium
      await Compendium.create({ label: "Toolbox Data", entity: entity });
      const pack = await game.packs.find(
        (p) => p.metadata.label === "Toolbox Data"
      );
      if (!pack) {
        return;
      }

      console.log(fieldDefault);

      let jsonData = null;
      let nameForDebugging = "";
      let failedMonsters = [];
      try {
        ui.notifications.info(game.i18n.localize("tb.processStarted"));
        for (let i = 0; i < data.length; i++) {
          let monster = data[i];
          nameForDebugging = monster.Name;
          let inputTemplate = `${monster.Name} CR ${monster.CR}

XP ${monster.XP} 
${monster.Alignment} ${monster.Size} ${monster.Race} ${monster.Type} ${
            monster.Class
          }
Init ${monster.Init}; Senses ${monster.Senses} ${
            monster.Aura ? `Aura ${monster.Aura}` : ""
          }
DEFENSE

AC ${monster.AC} ${monster.AC_Mods}
hp ${monster.HP} ${monster.HD}
${monster.Saves}
${
  monster.DefensiveAbilities
    ? `Defensive Abilities ${monster.DefensiveAbilities}`
    : ""
} ${monster.DR ? `DR ${monster.DR}` : ""} ${
            monster.Immune ? `Immune ${monster.Immune}` : ""
          } ${monster.SR ? `SR ${monster.SR}` : ""} ${
            monster.Weaknesses ? `Weaknesses ${monster.Weaknesses}` : ""
          }

OFFENSE
Speed ${monster.Speed} ${monster.Climb ? `Climb ${monster.Climb}` : ""} ${
            monster.Swim ? `Swim ${monster.Swim}` : ""
          } ${monster.Fly ? `Fly ${monster.Fly}` : ""} ${
            monster.Burrow ? `Burrow ${monster.Burrow}` : ""
          }
${monster.Melee ? `Melee ${monster.Melee}` : ""}
${monster.Ranged ? `Ranged ${monster.Ranged}` : ""}
Space ${monster.Space}; Reach ${monster.Reach}
${monster.SpecialAttacks ? `Special Attacks ${monster.SpecialAttacks}` : ""}
${
  monster.SpellLikeAbilities
    ? `Spell-Like Abilities ${monster.SpellLikeAbilities}`
    : ""
}

${
  monster.SpellsKnownFormatted
    ? `${monster.SpellsKnownFormatted.split("&").join("\n")}`
    : ""
}

STATISTICS
${monster.AbilityScores}
Base Atk ${monster.BaseAtk}; CMB ${monster.CMD}; CMD ${monster.CMB}
Feats ${monster.Feats}
${monster.Skills ? `Skills ${monster.Skills}` : ""}
${monster.RacialMods ? `Modifiers ${monster.RacialMods}` : ""}
${monster.SQ ? `SQ ${monster.SQ}` : ""}
Languages ${monster.Languages}

${
  monster.SpecialAbilities
    ? `Special Abilities ${monster.SpecialAbilities}`
    : ""
}

ECOLOGY
Environment ${monster.Environment}
Organization ${monster.Organization}
Treasure ${monster.Treasure}
${monster.Description}
`;

          let raceType = monster.Type.toLowerCase().replace(" ", "-");
          //fix annoying typo
          if (raceType == "aberration") {
            raceType = "abberation";
          }
          if (raceType == "humanoid") {
            raceType = "human";
          }
          let basePath = "systems/pf1/icons/races/";
          let otherDirNames = [
            "aberration",
            "animal",
            "construct",
            "dragon",
            "elemental",
            "fey",
            "magical-beast",
            "monstrous-humanoid",
            "ooze",
            "outsider",
            "plant",
            "undead",
            "vermin",
          ];
          if (otherDirNames.includes(raceType)) {
            basePath = basePath + "creature-types/";
          }
          if (monster.SpellsKnownFormatted) {
            console.log("breakpoint");
          }

          try {
            let converted = await window.convertStatBlock({
              value: inputTemplate,
            });
            let entity = await pack.createEntity(converted);
            entity.update({ img: basePath + raceType + ".png" }); // force update to auto-calculate other data (e.g. totals)
          } catch (e) {
            failedMonsters.push(inputTemplate);
          }
        }
        ui.notifications.info(
          game.i18n.format("tb.processCompleted", {
            count: totalCount,
            type: entity,
          })
        );
        console.log = tempfunc;
        console.log("Failed: ", failedMonsters);
      } catch (err) {
        ui.notifications.error(game.i18n.localize("ERROR.tbGenerationError"));
        console.log("Data Toolbox | JSON: " + jsonData);
        console.log(`Problem with ${nameForDebugging}`);
        throw new Error(err);
      }

      //game.settings.set("auto-sbc-toolbox", "template", template);
    }
  }

  format(text, data = {}) {
    const fmt = /\{\{[^\}]+\}\}/g;
    text = text.replace(fmt, (k) => {
      return data[k.slice(2, -2)];
    });
    return text;
  }
}

Hooks.once("init", () => {
  console.log("Data Toolbox | Init");
  loadTemplates(["modules/auto-sbc-toolbox/templates/dialog-toolbox.html"]);

  game.settings.register("auto-sbc-toolbox", "source", {
    scope: "world",
    config: false,
    type: String,
    default: "modules/auto-sbc-toolbox/samples/bestiary-sample.csv",
  });
  game.settings.register("auto-sbc-toolbox", "template", {
    scope: "world",
    config: false,
    type: String,
    default: "modules/auto-sbc-toolbox/samples/creature-template.json",
  });
  game.settings.register("auto-sbc-toolbox", "entity", {
    scope: "world",
    config: false,
    type: String,
    default: "Actor",
  });
});

function dtShowToolbox() {
  console.log("Data Toolbox | Show");

  game.settings.get("auto-sbc-toolbox", "source");

  renderTemplate("modules/auto-sbc-toolbox/templates/dialog-toolbox.html", {
    source: game.settings.get("auto-sbc-toolbox", "source"),
    template: game.settings.get("auto-sbc-toolbox", "template"),
    itemSelected:
      game.settings.get("auto-sbc-toolbox", "entity") === "Item"
        ? "selected"
        : "",
    actorSelected:
      game.settings.get("auto-sbc-toolbox", "entity") === "Actor"
        ? "selected"
        : "",
  }).then((html) => {
    new GenerateCompendiumDialog(null, { html: html }).render(true);
  });
}
