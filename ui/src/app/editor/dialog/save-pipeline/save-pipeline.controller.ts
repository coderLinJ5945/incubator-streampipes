/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import {RestApi} from "../../../services/rest-api.service";
import {NodeInfo, NodeMetadata} from "../../../configuration/model/NodeInfo.model";
import {Browser} from "leaflet";
import edge = Browser.edge;

export class SavePipelineController {

    RestApi: RestApi;
    $mdToast: any;
    $state: any;
    $mdDialog: any;
    pipelineCategories: any;
    pipeline: any;
    ObjectProvider: any;
    startPipelineAfterStorage: any;
    modificationMode: any;
    updateMode: any;
    submitPipelineForm: any;
    TransitionService: any;
    ShepherdService: any;
    edgeNodes: NodeInfo[]

    advancedSettings: boolean = false;

    deploymentOptions: Array<any> = new Array<any>();

    constructor($mdDialog,
                $state,
                RestApi,
                $mdToast,
                ObjectProvider,
                pipeline,
                modificationMode,
                TransitionService,
                ShepherdService) {
        this.RestApi = RestApi;
        this.$mdToast = $mdToast;
        this.$state = $state;
        this.$mdDialog = $mdDialog;
        this.pipelineCategories = [];
        this.pipeline = pipeline;
        this.ObjectProvider = ObjectProvider;
        this.modificationMode = modificationMode;
        this.updateMode = "update";
        this.TransitionService = TransitionService;
        this.ShepherdService = ShepherdService;
    }

    $onInit() {
        this.getPipelineCategories();
        if (this.ShepherdService.isTourActive()) {
            this.ShepherdService.trigger("enter-pipeline-name");
        }
        this.loadAndPrepareEdgeNodes();

    }

    loadAndPrepareEdgeNodes() {
        this.RestApi.getAvailableEdgeNodes().then(response => {
           //let edgeNodes = response.data as NodeInfo[];
            this.edgeNodes = response.data;
           this.addAppIds(this.pipeline.sepas, this.edgeNodes);
           this.addAppIds(this.pipeline.actions, this.edgeNodes);
        });
    }

    addAppIds(pipelineElements, edgeNodes: Array<NodeInfo>) {
        pipelineElements.forEach(pipelineElement => {
            this.deploymentOptions[pipelineElement.appId] = [];
            this.deploymentOptions[pipelineElement.appId].push(this.makeDefaultNodeInfo());
            edgeNodes.forEach(nodeInfo => {
                if (nodeInfo.supportedPipelineElementAppIds.some(appId => appId === pipelineElement.appId)) {
                    this.deploymentOptions[pipelineElement.appId].push(nodeInfo);
                }
            })
        });
    }

    makeDefaultNodeInfo() {
        let nodeInfo = {} as NodeInfo;
        nodeInfo.nodeControllerId = "default";
        nodeInfo.nodeMetadata = {} as NodeMetadata;
        nodeInfo.nodeMetadata.nodeAddress = "default";
        nodeInfo.nodeMetadata.nodeModel = "Default Node";
        return nodeInfo;
    }

    triggerTutorial() {
        if (this.ShepherdService.isTourActive()) {
            this.ShepherdService.trigger("save-pipeline-dialog");
        }
    }

    displayErrors(data) {
        for (var i = 0, notification; notification = data.notifications[i]; i++) {
            this.showToast("error", notification.title, notification.description);
        }
    }

    displaySuccess(data) {
        if (data.notifications.length > 0) {
            this.showToast("success", data.notifications[0].title, data.notifications[0].description);
        }
    }

    getPipelineCategories() {
        this.RestApi.getPipelineCategories()
            .then(pipelineCategories => {
                this.pipelineCategories = pipelineCategories.data;
            });

    };

    modifyPipelineElementsDeployments(pipelineElements) {
        pipelineElements.forEach(p => {
            let selectedTargetNodeId = p.deploymentTargetNodeId
            if(selectedTargetNodeId != "default") {
                let selectedNode = this.edgeNodes
                    .filter(node => node.nodeControllerId === selectedTargetNodeId)

                p.deploymentTargetNodeHostname = selectedNode
                    .map(node => node.nodeMetadata.nodeAddress)[0]

                p.deploymentTargetNodePort = selectedNode
                    .map(node => node.nodeControllerPort)[0]
            }
            else {
                p.deploymentTargetNodeHostname = null
                p.deploymentTargetNodePort = null
            }
        })
    }


    savePipelineName(switchTab) {
        if (this.pipeline.name == "") {
            this.showToast("error", "Please enter a name for your pipeline");
            return false;
        }

        let storageRequest;

        if (this.modificationMode && this.updateMode === 'update') {
            this.modifyPipelineElementsDeployments(this.pipeline.sepas)
            this.modifyPipelineElementsDeployments(this.pipeline.actions)
            storageRequest = this.RestApi.updatePipeline(this.pipeline);
        } else {
            this.modifyPipelineElementsDeployments(this.pipeline.sepas)
            this.modifyPipelineElementsDeployments(this.pipeline.actions)
            storageRequest = this.RestApi.storePipeline(this.pipeline);
        }

        storageRequest
            .then(msg => {
                let data = msg.data;
                if (data.success) {
                    this.afterStorage(data, switchTab);
                } else {
                    this.displayErrors(data);
                }
            }, data => {
                this.showToast("error", "Connection Error", "Could not fulfill request");
            });
    };

    afterStorage(data, switchTab) {
        this.displaySuccess(data);
        this.hide();
        this.TransitionService.makePipelineAssemblyEmpty(true);
        this.RestApi.removePipelineFromCache();
        if (this.ShepherdService.isTourActive()) {
            this.ShepherdService.hideCurrentStep();
        }
        if (switchTab && !this.startPipelineAfterStorage) {
            this.$state.go("streampipes.pipelines");
        }
        if (this.startPipelineAfterStorage) {
            this.$state.go("streampipes.pipelines", {pipeline: data.notifications[1].description});
        }
    }

    hide() {
        this.$mdDialog.hide();
    };

    showToast(type, title, description?) {
        this.$mdToast.show(
            this.$mdToast.simple()
                .textContent(title)
                .position("top right")
                .hideDelay(3000)
        );
    }

    toggleAdvancedSettings() {
        this.advancedSettings = ! (this.advancedSettings);
    }
}

SavePipelineController.$inject = ['$mdDialog', '$state', 'RestApi', '$mdToast', 'ObjectProvider', 'pipeline', 'modificationMode', 'TransitionService', 'ShepherdService'];