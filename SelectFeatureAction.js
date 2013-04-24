/**
 * Copyright (C) 2012
 *
 * This file is part of the project ohiggins
 *
 * This software is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option) any
 * later version.
 *
 * This software is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License along with
 * this library; if not, write to the Free Software Foundation, Inc., 51
 * Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA
 *
 * As a special exception, if you link this library with other files to produce
 * an executable, this library does not by itself cause the resulting executable
 * to be covered by the GNU General Public License. This exception does not
 * however invalidate any other reasons why the executable file might be covered
 * by the GNU General Public License.
 *
 * Author: Antonio Hernández <ahernandez@emergya.com>
 */


/**
 * @requires plugins/Tool.js
 */

/** api: (define)
 *  module = gxp.plugins
 *  class = SelectFeatureAction
 */

/** api: (extends)
 *  plugins/Tool.js
 */
Ext.namespace("gxp.plugins");

/** api: constructor
 *  .. class:: SelectFeatureAction(config)
 *
 *    Provides an action for showing the default search dialog.
 */
gxp.plugins.SelectFeatureAction = Ext.extend(gxp.plugins.Tool, {
    
    /** api: ptype = gxp_extendedtoolbar */
    ptype: "gxp_selectfeature",
    
    /** api: config[buttonText]
     *  ``String`` Text to show next to the zoom button
     */
    buttonText: 'Selección de elementos',
     
    /** api: config[menuText]
     *  ``String``
     *  Text for zoom menu item (i18n).
     */
    menuText: 'Selección de elementos',

    /** api: config[tooltip]
     *  ``String``
     *  Text for zoom action tooltip (i18n).
     */
    tooltip: 'Selección de elementos',
    
    /** private: property[iconCls]
     */
    iconCls: 'vw-icon-select-item',

    /** private: property[toolAction]
     */
    toolAction : null,

    /** private: property[selectedLayer]
     */
    selectedLayer: null,

    /** public: property[toggleGroup] */
    toggleGroup: null,
    
    /** private: method[constructor]
     */
    constructor: function(config) {
        gxp.plugins.SelectFeatureAction.superclass.constructor.apply(this, arguments);
    },

    /** private: method[init]
     * :arg target: ``Object`` The object initializing this plugin.
     */
    init: function(target) {
        gxp.plugins.SelectFeatureAction.superclass.init.apply(this, arguments);
        this.target.on('beforerender', this.addActions, this);
    },

    /** api: method[addActions]
     */
    addActions: function() {
        var featureManager = this._getFeatureManager();
        featureManager.on("layerchange", this._onLayerChange, this);

        var actions = gxp.plugins.SelectFeatureAction.superclass.addActions.apply(this, [{
            text: this.showButtonText ? this.buttonText : '',
            menuText: this.menuText,
            iconCls: this.iconCls,
            tooltip: this.tooltip,
            enableToggle: true,
            toggleGroup : this.toggleGroup,
            disabled: true,
            pressed: false,
            toggleHandler: function(action, state) {

                // We change the cursor over the map to indicate selection.
                Ext.select(".olMap").setStyle("cursor", state?"crosshair":"default");
                Viewer.getController('Map').toggleSelectFeature(state);

            },
            scope: this
        }]);

        this.toolAction = actions[0];
        return actions;
    },

     /** private: method[_onLayerChange]
     *  :arg mgr: :class:`gxp.plugins.FeatureManager`
     *  :arg layerRecord: ``GeoExt.data.LayerRecord``
     *  :arg schema: ``GeoExt.data.AttributeStore``
     */
    _onLayerChange : function(mgr, layerRecord, schema) {
        this.toolAction.setDisabled(!layerRecord);

        if(layerRecord) {
            this.selectedLayer = layerRecord.getLayer();    
        } else {
            this.selectedLayer = null;
        }
        
    },

     /** private: method[_getFeatureManager]
     *  :arg mgr: :class:`gxp.plugins.FeatureManager`
     *  :arg layer: ``GeoExt.data.LayerRecord``
     *  :arg schema: ``GeoExt.data.AttributeStore``
     */
    _getFeatureManager: function() {
        var  manager = window.app.tools["featuremanager"];
        if(!manager){
            throw new Error("Unable to access feature manager by id: " + this.featureManager);
        }
        return manager;
    },
        
});

Ext.preg(gxp.plugins.SelectFeatureAction.prototype.ptype, gxp.plugins.SelectFeatureAction);
