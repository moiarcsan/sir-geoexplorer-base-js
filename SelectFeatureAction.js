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

    /** public: property[featureManager]*/
    featureManager: "featuremanager",

    /** public: property[readOnly]*/
    readOnly : false,

    exceptionTitle: "Save Failed",
    exceptionText: "Trouble saving features",

    waitText: "Please wait...",

    /** private: property[selectionLayer]
     * Here we store the feature layer associated to the selected layer which we
     * will use to select features.
     */
    selectionLayer: null,

    /**
     * private: property[styleBackup]
     * Used to store the initial style of the feature layer so we can restore it 
     * when finishing a layer's selection.
     */
    styleBackup: null,
    
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
        featureManager.on("layerchange", this._enableOrDisable, this);
        app.on("loginstatechange", this._enableOrDisable,this);

        var style = OpenLayers.Util.extend({}, OpenLayers.Feature.Vector.style['default']);
        style.strokeColor = 'red'; 
        style.fillColor = 'red';

        // We create a new feature layer invisible in to the TOC where we will be adding the retrieved features.
        this.selectionLayer =  new OpenLayers.Layer.Vector(
            "selection layer",{
               "displayInLayerSwitcher":false,
                "style": style
            });
        Viewer.getMapPanel().map.addLayer(this.selectionLayer);
     

        var actions = gxp.plugins.SelectFeatureAction.superclass.addActions.apply(this, [{
            text: this.showButtonText ? this.buttonText : '',
            menuText: this.menuText,
            iconCls: this.iconCls,
            tooltip: this.tooltip,
            enableToggle: true,
            toggleGroup : this.toggleGroup,
            deactivateOnDisable: true,
            disabled: true,
            pressed: false,
            toggleHandler: function(action, state) {

                // We change the cursor over the map to indicate selection.
                Ext.select(".olMap").setStyle("cursor", state?"crosshair":"default");
                var mapCtr = Viewer.getController('Map');

                mapCtr.toggleSelectFeature(state);


                if(state) {
                    // We handle clicks directly on the map to retrieve the feature.
                    mapCtr.mapPanel.map.events.register("click", this, this._onMapClicked);

                    // We create a selection control for the temporal layer, so we can deselect features when we click the feature.
                    this.selectionControl = new OpenLayers.Control.SelectFeature(
                            this.selectionLayer, {  
                                renderIntent:"temporary",
                                eventListeners: {
                                    featurehighlighted: function(event) {
                                        // TODO: Remove feature from tmp layer.
                                        alert("Selected feature clicked: "+event.feature.fid);
                                    },
                                    scope: this
                                }
                            });

                    this.selectionControl.setMap(Viewer.getMapPanel().map);
                    Viewer.getMapPanel().map.addControl(this.selectionControl);

                   
                    this.selectionControl.initLayer(this.selectionLayer);
                    this.selectionControl.activate();
                } else {

                    mapCtr.mapPanel.map.events.unregister("click", this, this.noFeatureClick);

                    delete this.selectionLayer;
                    this.selectionLayer = null;

                   this.selectionControl.deactivate();
                }

            },
            scope: this
        }]);

        this.toolAction = actions[0];

        this._enableOrDisable();

        return actions;
    },

     /** private: method[_onMapClicked]
     *  :arg evt: ``Object``
     */
    _onMapClicked: function(evt) {

        var featureManager = this._getFeatureManager();
        var evtLL = this.target.mapPanel.map.getLonLatFromPixel(evt.xy);
        
        var page = featureManager.page;
        var layer = featureManager.layerRecord && featureManager.layerRecord.getLayer();
        if (!layer) {
            // if the feature manager has no layer currently set, do nothing
            return;
        }
        
        // construct params for GetFeatureInfo request
        // layer is not added to map, so we do this manually
        var map = this.target.mapPanel.map;
        var size = map.getSize();
        var params = Ext.applyIf({
            REQUEST: "GetFeatureInfo",
            BBOX: map.getExtent().toBBOX(),
            WIDTH: size.w,
            HEIGHT: size.h,
            X: parseInt(evt.xy.x),
            Y: parseInt(evt.xy.y),
            QUERY_LAYERS: layer.params.LAYERS,
            INFO_FORMAT: "application/vnd.ogc.gml",
            EXCEPTIONS: "application/vnd.ogc.se_xml",
            FEATURE_COUNT: 1,
            SRSNAME: map.projection
        }, layer.params);
        
        if (typeof this.tolerance === "number") {
            for (var i=0, ii=this.toleranceParameters.length; i<ii; ++i) {
                params[this.toleranceParameters[i]] = this.tolerance;
            }
        }

        Ext.Msg.wait(this.waitText);

        var store = new GeoExt.data.FeatureStore({
            fields: {},
            proxy: new GeoExt.data.ProtocolProxy({
                protocol: new OpenLayers.Protocol.HTTP({
                    url: (typeof layer.url === "string") ? layer.url : layer.url[0],
                    params: params,
                    format: new OpenLayers.Format.WMSGetFeatureInfo()
                })
            }),
            autoLoad: true,
            listeners: {
                "load": function(store, records) {
                    if (records.length > 0) {
                        Ext.Msg.updateProgress(1);
                        Ext.Msg.hide();

                        this.selectionLayer.addFeatures(records[0].data.feature);
                    }
                },
                scope: this
            }
        });
    },

    


      /** private: method[_enableOrDisable]
     */
     _enableOrDisable : function() {
        var mgr = this._getFeatureManager();
        var layerRecord = mgr.layerRecord;

        
        var authIdLayer = null;
        var authIdUser = null;
        var isAdmin = null;
        var layerId = null;
        var isTemporal = null;
        var layer = null;
        // Institución de la capa
        if(!!layerRecord && !!layerRecord.data && !!layerRecord.data.layer){
            layer = layerRecord.data.layer;
            if(layer.authId){
                authIdLayer = layer.authId;
            }

            if(layer.layerID) {
                layerId = layer.layerID;
            }

            if(layer.metadata && layer.metadata.temporal) {
                isTemporal = true;
            }
        } 
        // Institución del usuario
        if(!!app && !!app.persistenceGeoContext 
                && !!app.persistenceGeoContext.userInfo 
                && !!app.persistenceGeoContext.userInfo.authorityId){
            authIdUser = app.persistenceGeoContext.userInfo.authorityId;
            isAdmin = app.persistenceGeoContext.userInfo.admin
        }
        // Comprobamos si el usuario tiene permisos en la capa
        if(layer && (isTemporal || layerId && (isAdmin || !!authIdUser && authIdLayer == authIdUser))){

            this.actions[0].enable();
        }else{
            // Disable the edit options
            this.actions[0].disable();
        }
    },

     /** private: method[_getFeatureManager]
     */
    _getFeatureManager: function() {
        var  manager = window.app.tools[this.featureManager];
        if(!manager){
            throw new Error("Unable to access feature manager by id: " + this.featureManager);
        }
        return manager;
    },
        
});

Ext.preg(gxp.plugins.SelectFeatureAction.prototype.ptype, gxp.plugins.SelectFeatureAction);
