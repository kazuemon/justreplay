import { atom } from "jotai";
import { atomEffect } from "jotai-effect";
import { connectionStatusAtom } from "./connection-status";
import { OBSEventTypes } from "obs-websocket-js";
import { client } from "../obs";

type SceneItem =
	| {
			inputKind: string;
			isGroup: null;
			sourceName: string;
			sourceType: string;
			sceneItemId: number;
	  }
	| {
			inputKind: null;
			isGroup: true;
			sourceName: string;
			sourceType: string;
			sceneItemId: number;
	  };

type Scene = {
	name: string;
	items: SceneItem[];
};

export const scenesAtom = atom<Scene[]>([]);

export const scenesWatchAtom = atomEffect((get, set) => {
	if (!get(connectionStatusAtom)) {
		set(scenesAtom, []);
	} else {
		const onSceneListChanged = (e: OBSEventTypes["SceneListChanged"]) => {
			console.debug("SceneListChanged", e.scenes);
		};
		client.call("GetSceneList").then((e) => {
			const scenes = e.scenes as unknown as {
				sceneIndex: number;
				sceneName: string;
			}[];
			console.debug("SceneList", scenes);
			client
				.callBatch(
					scenes.map((scene) => ({
						requestType: "GetSceneItemList",
						requestData: { sceneName: scene.sceneName },
					})),
				)
				.then((e) => {
					const _scenes: Scene[] = [];
					e.forEach((v, i) => {
						if (v.requestType === "GetSceneItemList") {
							const items = v.responseData.sceneItems;
							console.debug("SceneItemList", scenes[i].sceneName, items);
							_scenes.push({
								name: scenes[i].sceneName,
								items: items as SceneItem[],
							});
						}
					});
					console.debug("SceneList", _scenes);
					set(scenesAtom, _scenes);
				});
		});
	}
});
