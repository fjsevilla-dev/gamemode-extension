import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gdk from 'gi://Gdk';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk'

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

class GameModePrefWidget extends Gtk.ListBox {
    static {
        GObject.registerClass(this);
    }

    constructor(settings) {
        super();
        this.selection_mode = Gtk.SelectionMode.NONE;
        this._settings = settings;
        this._blocked = [];
        
        this.margin_start = 24;
        this.margin_end = 24;
        this.margin_top = 24;
        this.margin_bottom = 24;
        
        this.append(this.make_row_switch('emit-notifications'));
        this.append(this.make_row_switch('always-show-icon'));
        this.append(this.make_row_switch('active-tint', 'active-color'));
    }

    make_row_switch(name, color) {
        let schema = this._settings.settings_schema;

        let row = new Gtk.ListBoxRow ();

        let hbox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
        });

        hbox.margin_start = 12;
        hbox.margin_end = 12;
        hbox.margin_top = 12;
        hbox.margin_bottom = 12;
        row.child = hbox;

        let vbox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});

        hbox.append(vbox);

        let sw = new Gtk.Switch({valign: Gtk.Align.CENTER});

        if (color) {
            let button = new Gtk.ColorButton({use_alpha: true});

            button.connect('notify::rgba', (widget, param) => {
                let rgba = widget.get_rgba();
                let css = rgba.to_string();
                let idx = this._blocked.push(color);
                this._settings.set_string(color, css);
                this._blocked.splice(idx);
            });

            this._update_color_from_setting(button, color);

            this._settings.connect(`changed::${color}`, () => {
                this._update_color_from_setting(button, color);
            });

            button.margin_start = 6;
            button.margin_end = 6;
            hbox.append(button);

            sw.bind_property('active', button, 'sensitive',
                             GObject.BindingFlags.SYNC_CREATE);

            let ckey = schema.get_key(color);
            button.set_tooltip_markup(ckey.get_description());
        }

        hbox.append(sw);
        
        let key = schema.get_key(name);

        let summary = new Gtk.Label({
            label: `<span size='medium'><b>${key.get_summary()}</b></span>`,
            hexpand: true,
            halign: Gtk.Align.START,
            use_markup: true
        });
        vbox.append(summary);
            
        let description = new Gtk.Label({
            label: `<span size='small'>${key.get_description()}</span>`,
            hexpand: true,
            halign: Gtk.Align.START,
            use_markup: true
        });
        description.get_style_context().add_class('dim-label');
        vbox.append(description);
        
        this._settings.bind(name, sw, 'active',
                            Gio.SettingsBindFlags.DEFAULT);
        return row;
    }

    _update_color_from_setting(widget, name) {
        let idx = this._blocked.indexOf(name);
        if (idx !== -1)
            return;

        let str = this._settings.get_string(name);
        let rgba = new Gdk.RGBA();
        rgba.parse(str);
        widget.set_rgba(rgba);
    }
};


class RowColorButton extends Gtk.ColorButton {
    static {
        GObject.registerClass({
            GTypeName: 'RowColorButton',
            Properties: {
                'css-color': GObject.ParamSpec.string(
                    'css-color', 'css color',
                    'The currently selected color, as a valid css color spec.',
                    GObject.ParamFlags.READWRITE,
                    ''),
            },
        }, this);
    }

    constructor(params) {
        super(params);
        this.bind_property_full(
            'css-color', this, 'rgba',
            GObject.BindingFlags.SYNC_CREATE |
            GObject.BindingFlags.BIDIRECTIONAL,
            (_, target)=> {
                let rgba = new Gdk.RGBA();
                rgba.parse(target);
                return [true, rgba];
            },
            (_, target)=>[true, target.to_string()]
        );
    }
};


class SwitchActionRow extends Adw.ActionRow {
    static {
        GObject.registerClass({
            GTypeName: 'SwitchActionRow',
            Properties: {
                'active-key': GObject.ParamSpec.string(
                    'active-key', 'Active key',
                    'Key name in settings that stores the switch active property.',
                    GObject.ParamFlags.READWRITE,
                    ''),
            },
        }, this);
    }

    constructor({settings, active_key, ...args}) {  
        super(args);
        this._settings = settings;
        this._suffix_container = new Gtk.Box(
            {orientation: Gtk.Orientation.HORIZONTAL}
        );
        this._switch = new Gtk.Switch({valign: Gtk.Align.CENTER});
        
        this.add_suffix(this._suffix_container);
        this.add_suffix(this._switch);
        this.set_activatable_widget(this._switch);
        this.activeKey = active_key;
    }

    get active_key() {
        return this._active_key;
    }

    set active_key(key) {
        if (this.active_key === key)
            return;
        if (this._settings.settings_schema.get_key(key)) {
            let schema_key = this._settings.settings_schema.get_key(key);
            this.title = schema_key.get_summary();
            this.subtitle = schema_key.get_description();
            this._settings.bind(key, this._switch, 'active',
                                Gio.SettingsBindFlags.DEFAULT);
            this._active_key = key;
            this.notify('active-key');
        }
    }
};


class ColorActionRow extends SwitchActionRow {
    static {
        GObject.registerClass({
            GTypeName: 'ColorActionRow',
            InternalChilds: ['color_btn'],
            Properties: {
                'color-key': GObject.ParamSpec.string(
                    'color-key', 'Color key',
                    'Key name in settings that stores the selected color.',
                    GObject.ParamFlags.READWRITE,
                    ''),
            },
        }, this);
    }

    constructor({color_key, ...args}) {  
        super(args);
        this._color_btn = new RowColorButton({valign: Gtk.Align.CENTER});
        this._suffix_container.append(this._color_btn);
        this.colorKey = color_key;
    }
    
    get color_key() {
        return this._color_key;
    }

    set color_key(key) {
        if (this.color_key === key)
            return;
        if (this._settings.settings_schema.get_key(key)) {
            let schema_key = this._settings.settings_schema.get_key(key);
            this._color_btn.set_tooltip_markup(schema_key.get_description());
            this._settings.bind(key, this._color_btn, 'css-color',
                                Gio.SettingsBindFlags.DEFAULT | 
                                Gio.SettingsBindFlags.NO_SENSITIVITY);
            this._color_key = key;
            this.notify('color-key');
        }
    }
};


export default class GamemodePrefs extends ExtensionPreferences {

    fillPreferencesWindow(window) {
        window._settings = this.getSettings();
        
        let settings_page = Adw.PreferencesPage.new();
        let main_group = Adw.PreferencesGroup.new();
    
        main_group.add(new SwitchActionRow(
            {settings: window._settings, active_key: 'emit-notifications'}));
        main_group.add(new SwitchActionRow(
            {settings: window._settings, active_key: 'always-show-icon'}));
        main_group.add(new ColorActionRow(
            {settings: window._settings, active_key: 'active-tint', color_key: 'active-color'}));    
            
        settings_page.add(main_group);
        window.add(settings_page);
    }
}
