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

Viewer.dialog.CreateBuffer = Ext.extend(Ext.Window, {

    /** api: config[geometryColumnName]
     *  ``String`` The name of the column storing the temporal layers' geometry in the database.
     */
    geometryColumnName : "geom",

    /** api: config[action]
     *  ``String`` The action creating this window.
     */
    action: null,

    UNIT_METERS: 'Meter',
    UNIT_KILOMETERS: 'Kilometer',
    UNIT_MILES: 'Mile',
    LAYER_NAME: 'Buffers',

    layerController: null,
    bufferLayer: null,
    
    form: null,

    waitText: "Por favor, espere...",
    errorText: "Se ha producido un error, inténtelo de nuevo en unos instantes.",
    confirmCreateText: "Se creará una capa temporal con el buffer previsualizado. ¿Desea continuar?",
    createBufferLayerText: "Crear capa con el buffer",
    dontCreateBufferLayerText: "No crear capa",
    bufferLayerCreatedText: "Se creó el buffer en la nueva capa '{0}' con éxito.",

    constructor: function(config) {

        this.listeners = {
            beforerender: this.onBeforeRender,
            show: this._onShow,
            hide: this._onHide,
            scope: this
        };

        Viewer.dialog.CreateBuffer.superclass.constructor.call(this, Ext.apply({
            cls: 'vw_new_buffer_window',
            title: 'Crear buffer',
            width: 400,
            height: 160,
            closeAction: 'hide',
            layout: 'fit'
        }, config));

        this.layerController = Viewer.getController('Layers');

        this.bufferLayer = this.layerController.create({
            "type": 'Vector',
            "name": this.LAYER_NAME,
            "options": {displayInLayerSwitcher:false}
        });

        this.map.addLayer(this.bufferLayer);
    },

    _onHide: function() {
        this.bufferLayer.removeAllFeatures();
    },

    _onShow: function() {
        this.distanceField.reset();
        this.radioGroup.reset();

        this.btnCreate.disable();
    },

    onCreateButtonClicked: function() {
        if (!this.distanceField.validate()) {
            // Shouldn't happen as the create button is disabled if the validation fails.
            return;
        }

        Ext.Msg.show({
            "title": "",
            "msg": this.confirmCreateText,
            "buttons": {
                "yes": this.createBufferLayerText,
                "no": this.dontCreateBufferLayerText,
            },
           "fn":  function(result) {
                if(result=="yes") {
                    this._doBufferLayerCreation();
                }
           },
           "scope": this,
           "modal": true

        });
    },

    _doBufferLayerCreation: function() {
        Ext.Msg.wait(this.waitText);
        Ext.Ajax.request({
            url: '../../vectorialLayerController/newTempLayer',
            params: {
                "layerName": "Buffer " + (new Date()).format("d-m-Y H:i:s.u"),
                    "geometryType": "POLYGON",

                },
                "success": function(response) {
                    this._addBufferLayerToMap(response.responseText);
                },
                "failure": function(form, action) {
                    Ext.Msg.updateProgress(1);
                    Ext.Msg.hide();

                    Ext.Msg.alert('Error', this.errorText);
                },
                scope: this
            });
        },

        _addBufferLayerToMap : function(responseText) {
            var resp = Ext.util.JSON.decode(responseText);

            if (resp && resp.success && resp.data && resp.data.status === "success") {
                //Add layer to map and close window
                var layerName = resp.data.layerName;
                var layerTitle = resp.data.layerTitle;
                var geoserverUrl = (resp.data.serverUrl) || (app.sources.local.url + "/wms");
                var layer = new OpenLayers.Layer.WMS(
                    layerTitle,
                    geoserverUrl, {
                        "layers": layerName,
                        "transparent": true
                    }, {
                        "opacity": 1,
                        "visibility": true
                    });

                layer.metadata.layerResourceId = resp.data.layerResourceId;
                layer.metadata.layerTypeId = resp.data.layerTypeId;
                layer.metadata.temporal = true;

                var map = Viewer.getMapPanel().map;
                map.addLayer(layer);

                 var self = this;
                 setTimeout(function(){
                    self._addFeaturesToLayer(layer);
                 },10000);

            } else if (resp && resp.success && resp.data && resp.data.status === "error") {
                Ext.Msg.alert('', resp.data.message);
            } else {
                Ext.Msg.alert('', this.errorText);
            }
        },

        _addFeaturesToLayer : function(layer) {
            var map = Viewer.getMapPanel().map;

            // We add the features to the created layer.
            var protocol = OpenLayers.Protocol.WFS.fromWMSLayer(layer,{
                "geometryName" : this.geometryColumnName
            });

            // Needed so procolol::commit doesn't fail.
            layer.projection = map.getProjectionObject();

            var features = this.bufferLayer.features;
            for(var fIdx=0; fIdx < features.length; fIdx++) {
                var feature = features[fIdx];

                feature.layer = layer;
                feature.state = OpenLayers.State.INSERT;
            }

            var self = this;
            protocol.commit(
                features,
                {
                    "callback": function(response) {
                        Ext.Msg.updateProgress(1);
                        Ext.Msg.hide();


                        if (!response.success()) {
                            Ext.Msg.alert("", self.errorText);
                            return;
                        }

                        

                        Ext.Msg.alert('', (new Ext.Template(self.bufferLayerCreatedText)).apply([layer.layerTitle]));

                        self.bufferLayer.removeAllFeatures();

                        layer.draw(true);
                    }
                });
        },

        onCancelButtonClicked: function() {
            this.hide();
        },

        createPreviewBuffer: function() {

            if (this._previewTimeout) {
                clearTimeout(this._previewTimeout);
            }

            var self = this;
            this._previewTimeout = setTimeout(

            function() {
                self._doPreviewBufferCreation();
            }, 200);


        },

        _doPreviewBufferCreation: function() {
            if(!this.distanceField.validate() || this.hidden) {
                return;             
            }


            this.bufferLayer.removeAllFeatures();
            var buffers = [];
            var radius = this.distanceField.getValue();
            var features = this.action.selectedFeatures;
            for (var i = 0, l = features.length; i < l; i++) {
                var buffer = this.layerController.createBufferForFeature(
                features[i],
                radius,
                this.radioGroup.getValue().getGroupValue());
                buffers.push(new OpenLayers.Feature.Vector(
                buffer,
                null, {
                    fillColor: 'yellow',
                    fillOpacity: 0.6
                }));
            }
            this.bufferLayer.addFeatures(buffers);

            this.btnCreate.enable();
        },

        onBeforeRender: function() {

            var padding = 'padding: 10px 16px;';
            var border = 'border: 0px solid transparent;'

            this.form = {
                xtype: 'form',
                layout: 'form',
                padding: '20px 10px',
                items: [
                new Ext.form.NumberField({
                    fieldLabel: 'Distancia',
                    anchor: '95%',
                    ref: "./distanceField",
                    validator: function(value) {
                        if(value==="") {
                            return false;
                        }

                        return value > 0 && value <= 10000;
                    },
                    listeners: {
                        scope: this,
                        valid: function() {
                            this.createPreviewBuffer();
                        },
                        invalid: function() {
                            this.btnCreate.disable();
                        }
                    }
                }),
                new Ext.form.RadioGroup({
                    ref: "./radioGroup",
                    items: [
                    new Ext.form.Radio({
                        boxLabel: 'Metros',
                        name: 'units',
                        inputValue: this.UNIT_METERS,
                        checked: true
                    }),
                    new Ext.form.Radio({
                        boxLabel: 'Kilómetros',
                        name: 'units',
                        inputValue: this.UNIT_KILOMETERS
                    }),
                    new Ext.form.Radio({
                        boxLabel: 'Millas',
                        name: 'units',
                        inputValue: this.UNIT_MILES
                    })],
                    listeners: {
                        scope: this,
                        change: function() {
                            this.createPreviewBuffer();    
                            
                        }
                    }
                })],
                buttons: [
                this.btnCreate = new Ext.Button({
                    text: 'Crear',
                    listeners: {
                        click: this.onCreateButtonClicked,
                        scope: this
                    }
                }),
                this.btnCancel = new Ext.Button({
                    text: 'Cancelar',
                    listeners: {
                        click: this.onCancelButtonClicked,
                        scope: this
                    }
                })]
            };

            this.add(this.form);
        }
    });