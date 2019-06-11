import {utils} from "../../viewer/scene/utils.js"
import {PerformanceModel} from "../../viewer/scene/PerformanceModel/PerformanceModel.js";
import {Plugin} from "../../viewer/Plugin.js";
import {GLTFDefaultDataSource} from "../GLTFLoaderPlugin/GLTFDefaultDataSource.js";
import {IFCObjectDefaults} from "../../viewer/metadata/IFCObjectDefaults.js";

class XeokitLoaderPlugin extends Plugin {

    constructor(viewer, cfg = {}) {

        super("XeokitLoaderPlugin", viewer, cfg);

        this.dataSource = cfg.dataSource;
        this.objectDefaults = cfg.objectDefaults;
    }

    /**
     * Sets a custom data source through which the GLTFLoaderPlugin can load metadata, glTF and binary attachments.
     *
     * Default value is {@link GLTFDefaultDataSource}, which loads via an XMLHttpRequest.
     *
     * @type {Object}
     */
    set dataSource(value) {
        this._dataSource = value || new GLTFDefaultDataSource();
    }

    /**
     * Gets the custom data source through which the GLTFLoaderPlugin can load metadata, glTF and binary attachments.
     *
     * Default value is {@link GLTFDefaultDataSource}, which loads via an XMLHttpRequest.
     *
     * @type {Object}
     */
    get dataSource() {
        return this._dataSource;
    }

    /**
     * Sets map of initial default states for each loaded {@link Entity} that represents an object.
     *
     * Default value is {@link IFCObjectDefaults}.
     *
     * @type {{String: Object}}
     */
    set objectDefaults(value) {
        this._objectDefaults = value || IFCObjectDefaults;
    }

    /**
     * Gets map of initial default states for each loaded {@link Entity} that represents an object.
     *
     * Default value is {@link IFCObjectDefaults}.
     *
     * @type {{String: Object}}
     */
    get objectDefaults() {
        return this._objectDefaults;
    }

    load(params = {}) {

        if (params.id && this.viewer.scene.components[params.id]) {
            this.error("Component with this ID already exists in viewer: " + params.id + " - will autogenerate this ID");
            delete params.id;
        }

        const performanceModel = new PerformanceModel(this.viewer.scene, utils.apply(params, {
            isModel: true
        }));

        if (!params.src && !params.xeokit) {
            this.error("load() param expected: src or xeokit");
            return performanceModel; // Return new empty model
        }

        const modelId = performanceModel.id;  // In case ID was auto-generated

        if (params.src) {
            const spinner = this.viewer.scene.canvas.spinner;
            spinner.processes++;
            utils.loadArraybuffer(params.src, (arrayBuffer) => {
                    this._parse(performanceModel, arrayBuffer, () => {
                        spinner.processes--;
                        performanceModel.fire("loaded", true);
                    }, (errMsg) => {
                        spinner.processes--;
                        this.error(errMsg);
                    });
                },
                (errMsg) => {
                    this.error(errMsg);
                });
        }

        return performanceModel;
    }

    Xload(params = {}) {

        const self = this;

        if (params.id && this.viewer.scene.components[params.id]) {
            this.error("Component with this ID already exists in viewer: " + params.id + " - will autogenerate this ID");
            delete params.id;
        }

        const model =  new PerformanceModel(this.viewer.scene, utils.apply(params, {
                isModel: true
            }));

        const modelId = model.id;  // In case ID was auto-generated

        if (!params.src && !params.gltf) {
            this.error("load() param expected: src or gltf");
            return model; // Return new empty model
        }

        if (params.metaModelSrc || params.metaModelData) {

            const objectDefaults = params.objectDefaults || this._objectDefaults || IFCObjectDefaults;

            const processMetaModelData = function (metaModelData) {

                self.viewer.metaScene.createMetaModel(modelId, metaModelData, {
                    includeTypes: params.includeTypes,
                    excludeTypes: params.excludeTypes
                });

                self.viewer.scene.canvas.spinner.processes--;

                var includeTypes;
                if (params.includeTypes) {
                    includeTypes = {};
                    for (let i = 0, len = params.includeTypes.length; i < len; i++) {
                        includeTypes[params.includeTypes[i]] = true;
                    }
                }

                var excludeTypes;
                if (params.excludeTypes) {
                    excludeTypes = {};
                    for (let i = 0, len = params.excludeTypes.length; i < len; i++) {
                        includeTypes[params.excludeTypes[i]] = true;
                    }
                }


                // params.handleGLTFNode = function (modelId, glTFNode, actions) {
                //
                //     const name = glTFNode.name;
                //
                //     if (!name) {
                //         return true; // Continue descending this node subtree
                //     }
                //
                //     const nodeId = name;
                //     const metaObject = self.viewer.metaScene.metaObjects[nodeId];
                //     const type = (metaObject ? metaObject.type : "DEFAULT") || "DEFAULT";
                //
                //     actions.createEntity = {
                //         id: nodeId,
                //         isObject: true // Registers the Entity in Scene#objects
                //     };
                //
                //     const props = objectDefaults[type];
                //
                //     if (props) { // Set Entity's initial rendering state for recognized type
                //
                //         if (props.visible === false) {
                //             actions.createEntity.visible = false;
                //         }
                //
                //         if (props.colorize) {
                //             actions.createEntity.colorize = props.colorize;
                //         }
                //
                //         if (props.pickable === false) {
                //             actions.createEntity.pickable = false;
                //         }
                //
                //         if (props.opacity !== undefined && props.opacity !== null) {
                //             actions.createEntity.opacity = props.opacity;
                //         }
                //     }
                //
                //     return true; // Continue descending this glTF node subtree
                // };

                if (params.src) {
                    loader.load(self, model, params.src, params);
                } else {
                    loader.parse(self, model, params.gltf, params);
                }
            };

            if (params.metaModelSrc) {

                const metaModelSrc = params.metaModelSrc;

                self.viewer.scene.canvas.spinner.processes++;

                self._dataSource.getMetaModel(metaModelSrc, (metaModelData) => {

                    self.viewer.scene.canvas.spinner.processes--;

                    processMetaModelData(metaModelData);

                }, function (errMsg) {
                    self.error(`load(): Failed to load model metadata for model '${modelId} from  '${metaModelSrc}' - ${errMsg}`);
                    self.viewer.scene.canvas.spinner.processes--;
                });

            } else if (params.metaModelData) {

                processMetaModelData(params.metaModelData);
            }

        } else {

            params.handleGLTFNode = function (modelId, glTFNode, actions) {

                const name = glTFNode.name;

                if (!name) {
                    return true; // Continue descending this node subtree
                }

                const id = name;

                actions.createEntity = { // Create an Entity for this glTF scene node
                    id: id,
                    isObject: true // Registers the Entity in Scene#objects
                };

                return true; // Continue descending this glTF node subtree
            };

            if (params.src) {
                loader.load(self, model, params.src, params);
            } else {
                loader.parse(self, model, params.gltf, params);
            }
        }

        model.once("destroyed", () => {
            this.viewer.metaScene.destroyMetaModel(modelId);
        });

        return model;
    }

    _parse(performanceModel, arrayBuffer, ok, error) {
        this._parseBlob(arrayBuffer, performanceModel, function () {
                performanceModel.scene.fire("modelLoaded", performanceModel.id); // FIXME: Assumes listeners know order of these two events
                performanceModel.fire("loaded", true, true);
                if (ok) {
                    ok();
                }
            },
            function (msg) {
                performanceModel.error(msg);
                performanceModel.fire("error", msg);
                if (error) {
                    error(msg);
                }
            });
    }

    _parseBlob(arrayBuffer, performanceModel) {

        const dataView = new DataView(arrayBuffer);
        const dataArray = new Uint8Array(arrayBuffer);

        const numElementsInBlob = dataView.getUint32(0, true);

        const readElements = [];

        for (var i = 0, totalOffset = (numElementsInBlob + 1) * 4; i < numElementsInBlob; i++) {
            const thisSize = dataView.getUint32((1 + i) * 4, true);
            readElements.push(dataArray.slice(totalOffset, thisSize + totalOffset));
            totalOffset += thisSize;
        }

        const compressedData = {
            meshes: {
                allColors: readElements[0],
                allEdgeIndices: readElements[1],
                allIndices: readElements[2],
                allMatrices: readElements[3],
                allEncodedNormals: readElements[4],
                allOpacities: readElements[5],
                allQuantizedPositions: readElements[6],
                allAABB: readElements[7],

                positionColors: readElements[8],
                positionEdgeIndices: readElements[9],
                positionIndices: readElements[10],
                positionMatrices: readElements[11],
                positionEncodedNormals: readElements[12],
                positionOpacities: readElements[13],
                positionQuantizedPositions: readElements[14],
                positionAABB: readElements[15],
            },
            entities: {
                allMeshesIds: readElements[16],
                allIds: readElements[17],
                allIsObject: readElements[18],
                positionMeshes: readElements[19],
            },
            positionsDecodeMatrix: readElements[20],
        };

        this._loadCompressedData(performanceModel, compressedData);
    }

    _loadCompressedData(performanceModel, compressedData) {
        const decompressedData = {
            meshes: {
                allColors: pako.inflate(compressedData.meshes.allColors.buffer),
                allEdgeIndices: pako.inflate(compressedData.meshes.allEdgeIndices.buffer),
                allIndices: pako.inflate(compressedData.meshes.allIndices.buffer),
                allMatrices: pako.inflate(compressedData.meshes.allMatrices.buffer),
                allEncodedNormals: pako.inflate(compressedData.meshes.allEncodedNormals.buffer),
                allOpacities: pako.inflate(compressedData.meshes.allOpacities.buffer),
                allQuantizedPositions: pako.inflate(compressedData.meshes.allQuantizedPositions.buffer),
                allAABB: pako.inflate(compressedData.meshes.allAABB.buffer),

                positionColors: pako.inflate(compressedData.meshes.positionColors.buffer),
                positionEdgeIndices: pako.inflate(compressedData.meshes.positionEdgeIndices.buffer),
                positionIndices: pako.inflate(compressedData.meshes.positionIndices.buffer),
                positionMatrices: pako.inflate(compressedData.meshes.positionMatrices.buffer),
                positionEncodedNormals: pako.inflate(compressedData.meshes.positionEncodedNormals.buffer),
                positionOpacities: pako.inflate(compressedData.meshes.positionOpacities.buffer),
                positionQuantizedPositions: pako.inflate(compressedData.meshes.positionQuantizedPositions.buffer),
                positionAABB: pako.inflate(compressedData.meshes.positionAABB.buffer),
            },
            entities: {
                allMeshesIds: pako.inflate(compressedData.entities.allMeshesIds.buffer),
                allIds: pako.inflate(compressedData.entities.allIds, {to: 'string'}),
                allIsObject: pako.inflate(compressedData.entities.allIsObject),

                positionMeshes: pako.inflate(compressedData.entities.positionMeshes.buffer),
            },
            positionsDecodeMatrix: pako.inflate(compressedData.positionsDecodeMatrix),
        };
        //console.timeEnd('decompress');

        this._loadDecompressedData(performanceModel, decompressedData);
    }

    _loadDecompressedData(performanceModel, decompressedData) {
        // Fill arrays for entities
        const positionColors = new Uint32Array(decompressedData.meshes.positionColors.buffer);
        const positionEdgeIndices = new Uint32Array(decompressedData.meshes.positionEdgeIndices.buffer);
        const positionIndices = new Uint32Array(decompressedData.meshes.positionIndices.buffer);
        const positionMatrices = new Uint32Array(decompressedData.meshes.positionMatrices.buffer);
        const positionEncodedNormals = new Uint32Array(decompressedData.meshes.positionEncodedNormals.buffer);
        const positionOpacities = new Uint32Array(decompressedData.meshes.positionOpacities.buffer);
        const positionQuantizedPositions = new Uint32Array(decompressedData.meshes.positionQuantizedPositions.buffer);
        const positionAABB = new Uint32Array(decompressedData.meshes.positionAABB.buffer);

        const allColors = new Float32Array(decompressedData.meshes.allColors.buffer);
        const allEdgeIndices = new Uint16Array(decompressedData.meshes.allEdgeIndices.buffer);
        const allIndices = new Uint16Array(decompressedData.meshes.allIndices.buffer);
        const allMatrices = new Float32Array(decompressedData.meshes.allMatrices.buffer);
        const allEncodedNormals = new Int8Array(decompressedData.meshes.allEncodedNormals.buffer);
        const allOpacities = new Float32Array(decompressedData.meshes.allOpacities.buffer);
        const allQuantizedPositions = new Uint16Array(decompressedData.meshes.allQuantizedPositions.buffer);
        const allAABB = new Float32Array(decompressedData.meshes.allAABB.buffer);

        const positionsDecodeMatrix = new Float32Array(decompressedData.positionsDecodeMatrix.buffer);

        const numMeshes = positionColors.length;
        //console.log("read meshes: " + numMeshes);

        const positionMeshes = new Uint32Array(decompressedData.entities.positionMeshes.buffer);

        const numEntities = positionMeshes.length;
        //console.log("read entities: " + numEntities);

        const allMeshesIds = new Uint32Array(decompressedData.entities.allMeshesIds.buffer);
        const allIsObject = new Uint8Array(decompressedData.entities.allIsObject.buffer);
        const allIds = JSON.parse(decompressedData.entities.allIds);

        //console.timeEnd('loadDecompressedData - 1');

        //console.time('loadDecompressedData - 2');
        performanceModel.createTile({
            id: performanceModel.id + "_tile",
        });

        // Regenerate meshes
        for (let i = 0; i < numMeshes; i++) {
            const last = (i === (numMeshes - 1));

            const meshCfg = {
                id: performanceModel.id + "." + i,
                color: allColors.slice(positionColors [i], last ? positionColors.length : positionColors [i + 1]),
                edgeIndices: allEdgeIndices.slice(positionEdgeIndices [i], last ? positionEdgeIndices.length : positionEdgeIndices [i + 1]),
                indices: allIndices.slice(positionIndices [i], last ? positionIndices.length : positionIndices [i + 1]),
                matrix: allMatrices.slice(positionMatrices [i], positionMatrices [i] + 16),
                encodedNormals: allEncodedNormals.slice(positionEncodedNormals [i], last ? positionEncodedNormals.length : positionEncodedNormals [i + 1]),
                opacity: allOpacities [positionOpacities [i]],
                quantizedPositions: allQuantizedPositions.slice(positionQuantizedPositions [i], last ? positionQuantizedPositions.length : positionQuantizedPositions [i + 1]),
                aabb: allAABB.slice(positionAABB [i], positionAABB [i] + 6),
                primitive: "triangles",
                positionsDecodeMatrix: positionsDecodeMatrix,
                isTransformedAndEncoded: true,
                isQuantized: true,
            };

            performanceModel.createMesh(meshCfg);
        }

        // Regenerate entities
        for (let i = 0; i < numEntities; i++) {
            const last = (i === numEntities - 1);

            const entityMeshIds = [];

            for (let from = positionMeshes [i], to = last ? positionMeshes.length : positionMeshes [i + 1]; from < to; from++) {
                entityMeshIds.push(performanceModel.id + "." + from);
            }

            const entity = {
                id: allIds [i],
                isObject: allIsObject [i] ? true : false,
                meshIds: entityMeshIds,
            };

            performanceModel.createEntity(entity);
        }

        performanceModel.finalize();

        //console.timeEnd('loadDecompressedData - 2');
    }
}

export {XeokitLoaderPlugin}