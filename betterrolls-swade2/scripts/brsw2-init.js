// Init scripts for version 2
/* globals Hooks, console, game, loadTemplates, Token, renderTemplate, Macro, CONFIG, foundry */
import {activate_common_listeners, manage_selectable_click, manage_collapsables,
    BRSW_CONST, get_action_from_click} from './cards_common.js';
import {attribute_card_hooks, activate_attribute_listeners,
    activate_attribute_card_listeners} from './attribute_card.js';
import {skill_card_hooks, activate_skill_listeners,
    activate_skill_card_listeners} from './skill_card.js';
import {activate_item_listeners, item_card_hooks,
    activate_item_card_listeners} from "./item_card.js";
import {activate_damage_card_listeners} from "./damage_card.js";
import {register_actions, SystemGlobalConfiguration, WorldGlobalActions} from "./global_actions.js";
import {activate_incapacitation_card_listeners} from "./incapacitation_card.js";
import {OptionalRulesConfiguration} from "./optinal_rules.js";
import {modifyTokenBars} from "./tokenbars.js";
import {activate_unshake_card_listeners} from "./unshake_card.js";

// Startup scripts

// Token Bar modifications
Hooks.once("setup", async function () {
  modifyTokenBars();
})

// Base Hook
Hooks.on(`ready`, () => {
    console.log('Better Rolls 2 for SWADE | Ready');
    // Create a base object to hook functions
    game.brsw = {};
    game.brsw.get_action_from_click = get_action_from_click;
    attribute_card_hooks();
    skill_card_hooks();
    item_card_hooks();
    register_settings_version2();
    register_actions();
    // Load partials.
    const templatePaths = ['modules/betterrolls-swade2/templates/common_card_header.html',
        'modules/betterrolls-swade2/templates/common_card_footer.html',
        'modules/betterrolls-swade2/templates/trait_roll_partial.html',
        'modules/betterrolls-swade2/templates/trait_result_partial.html',
        'modules/betterrolls-swade2/templates/damage_partial.html',
        'modules/betterrolls-swade2/templates/actions_partial.html'];
    loadTemplates(templatePaths).then(() => {
        console.log("Better Rolls templates preloaded")
    });
    // Collapse the char window if needed
    if (game.settings.get('betterrolls-swade2', 'collapse-chat-window')) {
        $('.brws-common-modifiers').addClass('brsw-collapsed');
        $('.brsw-chat-form i').removeClass('fa-caret-down').addClass('fa-caret-right');
    }
    // Add some jquery magic to allow binding our functions prior to system
    $.fn.bindFirst = function(name, fn) {
        // bind as you normally would
        // don't want to miss out on any jQuery magic
        this.on(name, fn);

        // Thanks to a comment by @Martin, adding support for
        // namespaced events too.
        this.each(function() {
            let handlers = $._data(this, 'events')[name.split('.')[0]];
            // take out the handler we just inserted from the end
            let handler = handlers.pop();
            // move it at the beginning
            handlers.splice(0, 0, handler);
        });
    };
})


// Hooks on render

Hooks.on('renderChatMessage', (message, html) => {
    let card_type = message.getFlag('betterrolls-swade2', 'card_type')
    if (card_type) {
        // This chat card is one of ours
        activate_common_listeners(message, html);
        if (card_type === BRSW_CONST.TYPE_ATTRIBUTE_CARD) {
            activate_attribute_card_listeners(message, html);
        } else if (card_type === BRSW_CONST.TYPE_SKILL_CARD) {
            activate_skill_card_listeners(message, html);
        } else if (card_type === BRSW_CONST.TYPE_ITEM_CARD) {
            activate_item_card_listeners(message, html);
        } else if (card_type === BRSW_CONST.TYPE_DMG_CARD) {
            activate_damage_card_listeners(message, html);
        } else if (card_type === BRSW_CONST.TYPE_INC_CARD) {
            activate_incapacitation_card_listeners(message, html);
        } else if (card_type === BRSW_CONST.TYPE_UNSHAKE_CARD) {
            activate_unshake_card_listeners(message, html);
        }
        // Hide forms to non-master, non owner
        if (game.user.id !== message.data.user && !game.user.isGM) {
            html.find('.brsw-form').addClass('brsw-collapsed');
        }
        // Hide master only sections
        if (!game.user.isGM) {
            html.find('.brsw-master-only').remove();
        }
        // Scroll the chat to the bottom if this is the last message
        if (game.messages.contents[game.messages.contents.length - 1] === message) {
            let chat_bar = $('#chat-log');
            if (chat_bar.length){
                if ((chat_bar[0].scrollHeight - chat_bar.height() * 2) < chat_bar[0].scrollTop){
                    chat_bar[0].scrollTop = chat_bar[0].scrollHeight;
                }
            }
        }
    }
});

// Hooks for the options form
Hooks.on('renderSidebarTab', (_, html) => {
    const place = html.find('#chat-controls');
    // noinspection JSIgnoredPromiseFromCall
    renderTemplate('modules/betterrolls-swade2/templates/options_form.html', {}).then(
        content => {
            content = $(content);
            // Activate selectable control.
            content.find('.brws-selectable').click(manage_selectable_click);
            place.before(content);
            manage_collapsables(content);
        }
    )
})

// Addon by JuanV, make attacks target by drag and drop
Hooks.on('dropCanvasData', (canvas, item) => {
    if (item.type === 'Item') {
        let grid_size = canvas.scene.data.grid
        const number_marked = canvas.tokens.targetObjects({
            x: item.x-grid_size/2,
            y: item.y-grid_size/2,
            height: grid_size,
            width: grid_size
        });
        if (number_marked) {
            const command = create_macro_command(item)
            eval('(async () => {' + command + '})()') // jshint ignore:line
        }
    }
});

function create_macro_command(data) {
    const bt = "`"
    return `
            let behaviour = game.brsw.get_action_from_click(event);
            if (behaviour === 'system') {
                game.swade.rollItemMacro(${bt}${data.data.name}${bt});
                return;
            }
            let message;
            if (${data.data.type === 'skill'}) {
                message = await game.brsw.create_skill_card_from_id('${data.tokenId}', '${data.actorId}', '${data.data._id}');
            } else {
                message = await game.brsw.create_item_card_from_id('${data.tokenId}', '${data.actorId}', '${data.data._id}');
            }
            if (event) {
                if (behaviour.includes('trait')) {
                    if (${data.data.type === 'skill'}) {                  
                        game.brsw.roll_skill(message, $(message.data.content), false)
                    } else {
                        game.brsw.roll_item(message, $(message.data.content), false, behaviour.includes('damage'))
                    }
                }
            }
        `
}

Hooks.on('hotbarDrop', async (bar, data, slot) => {
    if (data.type === 'Item') {
        const command = create_macro_command(data);
        let macro = await Macro.create(({
            name: data.data?.name,
            type: 'script',
            img: data.data?.img,
            command: command,
            scope: 'global'
        }))
        await game.user.assignHotbarMacro(macro, slot)
        return false
    }
});

// Hooks for Dice So Nice
Hooks.once('diceSoNiceReady', () => {
    register_dsn_settings();
});

// Character sheet hooks

['SwadeCharacterSheet', 'SwadeNPCSheet', 'CharacterSheet'].forEach(name => {
    Hooks.on('render' + name, (app, html, _) => {
        activate_attribute_listeners(app, html);
        activate_skill_listeners(app, html);
        activate_item_listeners(app, html);
        // Edit with right click, like skills.
        html.find('.item').on('contextmenu', (ev) => {
            const actor = app.token ? app.token.actor : app.object;
            const item = actor.items.get(ev.currentTarget.dataset.itemId);
            item.sheet.render(true);
        })
    })
})


// Settings

function register_settings_version2() {
    game.settings.registerMenu('betterrolls-swade2', 'system_global_actions', {
        name: "BRSW.SystemGlobalMenu",
        label: "BRSW.SystemGlobalMenuLabel",
        hint: "BRSW.SystemGlobalMenuHint",
        type: SystemGlobalConfiguration
    });
    game.settings.registerMenu('betterrolls-swade2', 'world_global-Menus', {
       name: "BRSW.WorldGlobalMenu",
       label: "BRSW.WorldGlobalMenuLabel",
       hint: "BRSW.WorldGlobalMenuHint",
       type: WorldGlobalActions
    });
    game.settings.registerMenu('betterrolls-swade2', 'optional_rules', {
        name: "BRSW.OptionalRules",
        label: "BRSW.OptionalRulesLabel",
        hint: "BRSW.OptionalRulesHint",
        type: OptionalRulesConfiguration
    });
    game.settings.register('betterrolls-swade2', 'system_action_disabled', {
        name: "System_Actions_disabled",
        default: [],
        type: Array,
        scope: "world",
        config: false
    });
    game.settings.register('betterrolls-swade2', 'optional_rules_enabled', {
        name: "Optional rules enabled",
        default: [],
        type: Array,
        scope: "world",
        config: false
    });
    game.settings.register('betterrolls-swade2', 'world_global_actions', {
        name: "World global actions",
        default: [],
        type: Array,
        config: false,
        scope: "world"
    });
    const br_choices = {
        system: game.i18n.localize('BRSW.Default_system_roll'),
        card: game.i18n.localize('BRSW.Show_Betterrolls_card'),
        trait: game.i18n.localize('BRSW.Show_card_and_trait'),
        trait_damage: game.i18n.localize('BRSW.Show_card_damage')
    };
    game.settings.register('betterrolls-swade2', 'click', {
        name: game.i18n.localize('BRSW.Single_click_action'),
        hint: game.i18n.localize('BRSW.Single_click_hint'),
        default: "card",
        scope: "world",
        type: String,
        choices: br_choices,
        config: true
    });
    game.settings.register('betterrolls-swade2', 'shift_click', {
        name: game.i18n.localize('BRSW.Shift_click_action'),
        hint: game.i18n.localize('BRSW.Shit_click_hint'),
        default: "system",
        scope: "world",
        type: String,
        choices: br_choices,
        config: true
    });
    game.settings.register('betterrolls-swade2', 'ctrl_click', {
        name: game.i18n.localize('BRSW.Control_click_action'),
        hint: game.i18n.localize('BRWS.Control_click_hint'),
        default: "trait",
        scope: "world",
        type: String,
        choices: br_choices,
        config: true
    });
    game.settings.register('betterrolls-swade2', 'alt_click', {
        name: game.i18n.localize('BRSW.Alt_click_action'),
        hint: game.i18n.localize('BRSW.Alt_click_hint'),
        default: "system",
        scope: "world",
        type: String,
        choices: br_choices,
        config: true
    });
    game.settings.register('betterrolls-swade2', 'default_rate_of_fire', {
        name: game.i18n.localize('BRSW.Default_rate_of_fire'),
        hint: game.i18n.localize('BRSW.Default_rate_of_fire_hint'),
        default: "max_rof",
        scope: "client",
        type: String,
        choices: {
            single_shot: game.i18n.localize('BRSW.Single_shot'),
            max_rof: game.i18n.localize('BRSW.Max_rate_of_fire')
        },
        config: true
    });
    game.settings.register('betterrolls-swade2', 'result-card', {
        name: game.i18n.localize('BRSW.See_result_card'),
        hint: game.i18n.localize('BRSW.See_result_hint'),
        default: 'all',
        scope: 'world',
        type: String,
        choices: {
            master: game.i18n.localize('BRSW.Master_only_result_card'),
            all: game.i18n.localize('BRSW.Everybody')
        },
        config: true
    });
    game.settings.register('betterrolls-swade2', 'expand-results', {
        name: game.i18n.localize('BRSW.expand-results'),
        hint: game.i18n.localize('BRSW.expand-results_hint'),
        default: false,
        scope: 'world',
        type: Boolean,
        config: true
    });
    game.settings.register('betterrolls-swade2', 'expand-rolls', {
        name: game.i18n.localize('BRSW.expand-rolls'),
        hint: game.i18n.localize('BRSW.expand-rolls_hint'),
        default: false,
        scope: 'world',
        type: Boolean,
        config: true
    });
    game.settings.register('betterrolls-swade2', 'collapse-chat-window', {
        name: game.i18n.localize('BRSW.collapse-chat-window'),
        hint: game.i18n.localize('BRSW.collapse-chat-window_hint'),
        default: false,
        scope: 'world',
        type: Boolean,
        config: true
    });
    game.settings.register('betterrolls-swade2', 'collapse-modifiers', {
        name: game.i18n.localize('BRSW.collapse-modifiers'),
        hint: game.i18n.localize('BRSW.collapse-modifiers_hint'),
        default: false,
        scope: 'world',
        type: Boolean,
        config: true
    });
    game.settings.register('betterrolls-swade2', 'default-ammo-management', {
        name: game.i18n.localize('BRSW.AmmoManagement'),
        hint: game.i18n.localize('BRSW.AmmoManagementHint'),
        default: true,
        scope: 'world',
        type: Boolean,
        config: true
    });
    game.settings.register('betterrolls-swade2', 'default-pp-management', {
        name: game.i18n.localize('BRSW.PPManagement'),
        hint: game.i18n.localize('BRSW.PPManagementHint'),
        default: true,
        scope: 'world',
        type: Boolean,
        config: true
    });
    game.settings.register('betterrolls-swade2', 'hide-reroll-fumble', {
        name: game.i18n.localize('BRSW.HideReRolls'),
        hint: game.i18n.localize('BRSW.HideReRollsHint'),
        default: false,
        scope: 'world',
        type: Boolean,
        config: true
    });
    game.settings.register('betterrolls-swade2', 'hide-weapon-actions', {
        name: game.i18n.localize("BRSW.HideWeaponActions"),
        hint: game.i18n.localize("BRSW.HideWeaponActionsHint"),
        default: false,
        scope: 'world',
        type: Boolean,
        config: true
    });
    game.settings.register('betterrolls-swade2', 'wound-cap', {
        name: game.i18n.localize("BRSW.WoundCap"),
        hint: game.i18n.localize("BRSW.WoundCapHint"),
        default: 0,
        scope: 'world',
        type: Number,
        config: false
    });
    game.settings.register('betterrolls-swade2', 'disable-gang-up', {
        name: game.i18n.localize("BRSW.DisableGangUp"),
        hint: game.i18n.localize("BRSW.DisableGangUpHint"),
        default: false,
        scope: 'world',
        type: Boolean,
        config: true
    });
    game.settings.register('betterrolls-swade2', 'remaining_card_behaviour', {
        name: game.i18n.localize('BRSW.RemainingBehaviour'),
        hint: game.i18n.localize('BRSW.RemainingBehaviour_hint'),
        default: "everybody",
        scope: "world",
        type: String,
        choices: {
            none: game.i18n.localize('BRSW.None'),
            master_only: game.i18n.localize('BRSW.MasterOnly'),
            master_and_gm: game.i18n.localize('BRSW.MasterAndGM'),
            everybody: game.i18n.localize("BRSW.Everybody")
        },
        config: true
    });
    game.settings.register('betterrolls-swade2', 'swd-unshake', {
        name: game.i18n.localize("BRSW.SWD-Unshake"),
        hint: game.i18n.localize("BRSW.SWD-UnshakeHint"),
        default: false,
        scope: 'world',
        type: Boolean,
        config: true
    });
}

// Settings related to Dice So Nice.

function register_dsn_settings(){
    // noinspection JSFileReferences
    import(foundry.utils.getRoute('/modules/dice-so-nice/DiceColors.js')).then(dsn => {
        let theme_choice = {};
        // noinspection JSUnresolvedVariable
        for (let theme in dsn.COLORSETS) {
            // noinspection JSUnresolvedVariable
            if (dsn.COLORSETS.hasOwnProperty(theme)) {
                theme_choice[theme] = theme;
            }
        }
        let damage_theme_choice = Object.assign({}, theme_choice);
        damage_theme_choice.None = 'None';
        game.settings.register('betterrolls-swade2', 'damageDieTheme', {
            name: game.i18n.localize("BRSW.DamageDiceTheme"),
            hint: game.i18n.localize("BRSW.DamageDiceThemeHint"),
            default: "None",
            scope: "client",
            type: String,
            choices: damage_theme_choice,
            config: true
        });
    }).catch(()=>{console.log('Dice So Nice not installed')});
}
