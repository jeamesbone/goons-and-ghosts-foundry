/**
 * Goons and Ghosts System
 * Main JavaScript file
 */

// Import necessary Foundry VTT classes if needed (though often available globally)
// import { ActorSheet } from "@foundryvtt/foundryvtt-api/classes/apps/ActorSheet";
// import { Actor } from "@foundryvtt/foundryvtt-api/classes/documents/Actor";
// import { Item } from "@foundryvtt/foundryvtt-api/classes/documents/Item";

console.log("Goons & Ghosts | Initializing System");

/* -------------------------------------------- */
/* Character Sheet Application                 */
/* -------------------------------------------- */

/**
 * Extend the basic ActorSheet class to handle Goons and Ghosts characters.
 * @extends {ActorSheet}
 */
class GoonsAndGhostsCharacterSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["goons-and-ghosts", "sheet", "actor", "character"], // CSS classes for styling
      template: "systems/goons-and-ghosts/templates/actors/actor-character-sheet.html", // Path to the HTML template
      width: 600,
      height: 650,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }] // If using tabs
      // Add dragDrop handling if needed: dragDrop: [{dragSelector: ".item-list .item", dropSelector: null}]
    });
  }

  /**
   * Prepare data for the HTML template.
   * @override
   */
  getData() {
    // The context object contains all the data passed to the template.
    const context = super.getData();

    // Alias actor data and items for easier access in the template
    context.actorData = context.actor.system; // Use context.actor.system for v10+ data model
    context.data = context.actor.system; // Common alias
    context.items = context.actor.items; // Actor's owned items

    // Prepare items by type (optional, but helpful for sorting/display)
    this._prepareCharacterItems(context);

    console.log("Goons & Ghosts | Character Sheet Data:", context); // For debugging
    return context;
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} sheetData The sheet data to prepare.
   * @private
   */
  _prepareCharacterItems(sheetData) {
    const actorData = sheetData.actor; // In v10+, actorData is sheetData.actor

    // Initialize containers.
    const gear = [];
    const gadgets = [];
    const backgroundFeatures = [];

    // Iterate through items, allocating to containers
    for (let i of sheetData.items) {
      i.img = i.img || DEFAULT_TOKEN; // Default image if none provided
      // Append to gear.
      if (i.type === 'gear') {
        gear.push(i);
      }
      // Append to gadgets.
      else if (i.type === 'gadget') {
        gadgets.push(i);
      }
      // Append to background features
      else if (i.type === 'backgroundFeature') {
        backgroundFeatures.push(i);
      }
    }

    // Assign categorized items back to the sheet data for template access
    // Note: In v10+, you modify sheetData directly or return the context
    actorData.gear = gear;
    actorData.gadgets = gadgets;
    actorData.backgroundFeatures = backgroundFeatures;

    // It's often useful to group them all for a single list display too
    sheetData.categorizedItems = {
        gear: gear,
        gadgets: gadgets,
        backgroundFeatures: backgroundFeatures
    };
  }


  /**
   * Activate event listeners for interactive elements on the sheet.
   * @override
   */
  activateListeners(html) {
    super.activateListeners(html);

    // --- Readonly Sheet Section ---
    // Prevent potential issues with Foundry's default listeners
    // if (!this.options.editable) return; // Uncomment if you need a read-only mode

    // --- Item Controls ---
    // Edit Item
    html.find('.item-edit').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    // Delete Item
    html.find('.item-delete').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      this.actor.deleteEmbeddedDocuments("Item", [li.data("itemId")]); // Use deleteEmbeddedDocuments for v10+
      li.slideUp(200, () => this.render(false)); // Re-render the sheet after deletion
    });

    // --- Roll Buttons ---
    // Ability Roll Listener
    html.find('.rollable[data-roll-type="ability"]').click(this._onRollAbility.bind(this));

    // Particle Thrower Roll Listener
    html.find('.roll-button[data-roll-type="particle"]').click(this._onRollParticle.bind(this));

    // Action Roll Button Listener (Generic)
    // You might want more specific buttons later
    html.find('.roll-button[data-roll-type="action"]').click(this._onRollAction.bind(this));

    // --- Add other listeners for things like adding items, drag/drop, etc. ---
    // Example: Add Item Button (if you add one to the HTML)
    // html.find('.item-create').click(this._onItemCreate.bind(this));
  }

  /**
   * Handle requests to roll an Ability check (Action Roll).
   * @param {Event} event The triggering click event
   * @private
   */
  async _onRollAbility(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;
    const abilityKey = dataset.ability; // e.g., "body", "smarts", "esp"
    const ability = this.actor.system.abilities[abilityKey];

    if (!ability) {
      console.error(`Goons & Ghosts | Ability ${abilityKey} not found!`);
      return;
    }

    const abilityName = game.i18n.localize(`GOONSNGHOSTS.Ability${abilityKey.charAt(0).toUpperCase() + abilityKey.slice(1)}`);
    const abilityScore = ability.value || 0;

    // --- Basic Roll Formula ---
    // 2d6 + Ability Score
    // TODO: Add logic to prompt for or automatically include relevant Gadget bonus
    let rollFormula = `2d6 + ${abilityScore}`;
    let gadgetBonus = 0; // Placeholder

    // --- Prompt for Gadget Bonus (Example) ---
    // This is a simple example; a more robust solution might involve selecting gadgets from the sheet.
    const gadgetPrompt = await Dialog.prompt({
        title: `Use Gadget for ${abilityName} Roll?`,
        content: `<p>Enter bonus from relevant Gadgets (usually +1 per gadget):</p><input type="number" value="0" min="0" step="1" />`,
        label: "Roll",
        callback: (html) => parseInt(html.find('input').val()) || 0,
        rejectClose: false // Allow closing without rolling
    });

    if (gadgetPrompt === null) return; // User cancelled

    gadgetBonus = gadgetPrompt;
    if (gadgetBonus > 0) {
        rollFormula += ` + ${gadgetBonus}`;
    }

    // --- Perform the Roll ---
    let roll = new Roll(rollFormula, this.actor.getRollData()); // Pass actor data for potential @ references
    await roll.evaluate({async: true}); // Evaluate the roll

    // --- Display the Roll ---
    // TODO: Add logic to compare against a Difficulty Score (DS)
    // TODO: Add logic for handling dangerous actions and damage calculation
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `${abilityName} Action Roll` // Customize the chat message flavor text
      // You can add flags here for custom handling by chat hooks if needed
    });

    console.log(`Goons & Ghosts | Rolled ${abilityName}: Formula=${rollFormula}, Result=${roll.total}`);
  }

   /**
   * Handle requests to roll a generic Action Roll (using the button).
   * This might prompt the user to select which ability to use.
   * @param {Event} event The triggering click event
   * @private
   */
  async _onRollAction(event) {
     event.preventDefault();
     // TODO: Implement logic for a generic action roll.
     // This could involve a dialog asking which ability to use,
     // or it could be a placeholder for more specific action buttons later.
     ui.notifications.info("Generic Action Roll button clicked - Implement me!");
     console.log("Goons & Ghosts | Generic Action Roll requested");

     // Example: Prompt for ability
     const abilities = this.actor.system.abilities;
     const abilityChoices = Object.keys(abilities).reduce((acc, key) => {
        acc[key] = game.i18n.localize(`GOONSNGHOSTS.Ability${key.charAt(0).toUpperCase() + key.slice(1)}`);
        return acc;
     }, {});

     const chosenAbility = await Dialog.prompt({
        title: "Choose Ability for Action Roll",
        content: `<p>Select the ability for this action:</p>
                  <select id="ability-select">
                    ${Object.entries(abilityChoices).map(([key, name]) => `<option value="${key}">${name}</option>`).join('')}
                  </select>`,
        label: "Select",
        callback: (html) => html.find('#ability-select').val(),
        rejectClose: false
     });

     if (chosenAbility) {
        // Simulate a click event on the chosen ability label to reuse the _onRollAbility logic
        const fakeEvent = { preventDefault: () => {}, currentTarget: this.element.find(`.rollable[data-ability='${chosenAbility}']`)[0] };
        await this._onRollAbility(fakeEvent);
     }
  }


  /**
   * Handle requests to roll for a Particle Thrower attack.
   * @param {Event} event The triggering click event
   * @private
   */
  async _onRollParticle(event) {
    event.preventDefault();
    // --- Basic Roll Formula ---
    // 1d6 per character firing (this sheet only rolls for this character)
    // TODO: Add system for tracking multiple characters firing together
    // TODO: Add logic for handling "Crossing the Streams" (double 1s)
    // TODO: Add logic for comparing total roll against Ghost HP and calculating damage
    // TODO: Add logic for +1 bonus for insults

    let rollFormula = `1d6`;
    let roll = new Roll(rollFormula, this.actor.getRollData());
    await roll.evaluate({async: true});

    // --- Display the Roll ---
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `Fires Particle Thrower!`
    });

    console.log(`Goons & Ghosts | Rolled Particle Thrower: Formula=${rollFormula}, Result=${roll.total}`);
    ui.notifications.info("Particle Thrower Roll - Implement teamwork and damage logic!");
  }

  /**
   * Handle creating a new item for the actor.
   * @param {Event} event The triggering click event
   * @private
   */
   async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const type = header.dataset.type; // Assumes you add data-type="gadget" etc. to a create button
    // Grab any data associated with this control.
    const data = duplicate(header.dataset);
    // Initialize a default name.
    const name = `New ${type.capitalize()}`;
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      system: data // Pass any predefined data
    };
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.system["type"];

    // Finally, create the item!
    return await Item.create(itemData, {parent: this.actor});
  }

  // Add more helper methods as needed for sheet logic...

}

/* -------------------------------------------- */
/* System Initialization                       */
/* -------------------------------------------- */

Hooks.once('init', async function() {
  console.log('Goons & Ghosts | Initializing Goons and Ghosts System');

  // Assign custom classes and constants here
  // e.g., game.goonsandghosts = { GoonsAndGhostsActor, GoonsAndGhostsItem };

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet); // Unregister the default sheet
  Actors.registerSheet("goons-and-ghosts", GoonsAndGhostsCharacterSheet, {
      types: ["character"], // Register this sheet for the "character" actor type
      makeDefault: true,
      label: "Goons & Ghosts Character Sheet"
  });

  // Register sheets for other actor types (like ghosts) and items if you create them
  // Actors.registerSheet("goons-and-ghosts", GoonsAndGhostsGhostSheet, { types: ["ghost"], makeDefault: true, label: "Goons & Ghosts Ghost Sheet" });
  // Items.unregisterSheet("core", ItemSheet);
  // Items.registerSheet("goons-and-ghosts", GoonsAndGhostsItemSheet, { makeDefault: true, label: "Goons & Ghosts Item Sheet" });


  // Preload Handlebars templates
  // await preloadHandlebarsTemplates(); // Define this function if needed

  // Define custom Handlebars helpers if needed
  // Handlebars.registerHelper('concat', function() { ... });

  // Register custom system settings
  // game.settings.register("goons-and-ghosts", "mySetting", { ... });

  console.log('Goons & Ghosts | System Initialization Complete');
});

/* -------------------------------------------- */
/* Foundry Ready Hook                          */
/* -------------------------------------------- */

Hooks.once('ready', async function() {
  // Perform actions once Foundry VTT is ready
  console.log('Goons & Ghosts | Foundry VTT is Ready!');
  // Example: Apply migrations or check system versions
});

/* -------------------------------------------- */
/* Other Hooks                                 */
/* -------------------------------------------- */

// Example: Hook into chat message rendering
// Hooks.on('renderChatMessage', (message, html, data) => {
//   // Modify chat message appearance or add buttons
// });

// Example: Hook into combat turn changes
// Hooks.on('updateCombat', (combat, changed, options, userId) => {
//   // Trigger effects or updates based on combat state
// });


// --- Helper Functions (Example) ---

/**
 * Preloads handlebars templates.
 */
/* // Uncomment and implement if needed
async function preloadHandlebarsTemplates() {
    const templatePaths = [
        // Add paths to your other templates here
        "systems/goons-and-ghosts/templates/items/item-gadget-sheet.html",
        "systems/goons-and-ghosts/templates/actors/actor-ghost-sheet.html"
    ];
    return loadTemplates(templatePaths);
}
*/
