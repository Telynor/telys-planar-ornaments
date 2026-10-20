const HSR_ID = "telys-star-rail-ultimates";
export function planarSheetActor(app) {
  const document = app?.document ?? app?.object ?? app?.actor;
  return document?.documentName === "Actor" ? document : null;
}

export function planarHeaderGroup(app, root, actor) {
  if (!actor || planarSheetActor(app) !== actor) return null;
  const shared = globalThis.game?.modules?.get(HSR_ID)?.api?.getActorSheetControls?.(app,root);
  if (shared) return shared;
  const frame = root?.closest?.(".application,.window-app") ?? root;
  const header = frame?.querySelector?.(".window-header,.window-header-container");
  if (!header) return null;
  let group = header.querySelector("[data-tsru-actor-controls]");
  if (!group) {
    group = document.createElement("nav"); group.className = "tsru-actor-config-controls tp-sheet-header-controls";
    group.dataset.tsruActorControls = "true"; group.dataset.actorUuid = actor.uuid;
    group.setAttribute("aria-label","Star Rail Actor configuration");
    const controls = header.querySelector(".window-controls"), close = header.querySelector('[data-action="close"],button.close,a.close');
    if (controls) controls.prepend(group); else if (close) close.before(group); else header.append(group);
  }
  return group;
}

export function injectPlanarHeader(app, root, actor, {openActor,openConfig}) {
  if (!globalThis.game?.user?.isGM && (actor.type !== "character" || !actor.testUserPermission?.(game.user,"OWNER"))) return null;
  const group = planarHeaderGroup(app,root,actor);
  if (!group) return null;
  let button = group.querySelector('[data-actor-control="planar"]');
  if (!button) {
    button = document.createElement("button"); button.type = "button";
    button.className = "header-control icon tsru-actor-header-control tp-sheet-header-open";
    button.dataset.actorControl = "planar"; button.dataset.actorControlOrder = "40";
    const title = actor.type === "character" ? "Planar Relics — equipment, upgrades and set details" : "Configure Planar Relics — GM set, currency and material settings";
    button.title = title; button.setAttribute("aria-label", actor.type === "character" ? "Planar Relics" : "Configure Planar Relics");
    button.innerHTML = '<i class="fas fa-circle-nodes" aria-hidden="true"></i>';
    button.addEventListener("click",event => {event.preventDefault();event.stopPropagation();actor.type === "character" ? openActor(actor.id) : openConfig();});
    group.append(button);
  }
  for (const node of [...group.children].sort((a,b)=>Number(a.dataset.actorControlOrder??99)-Number(b.dataset.actorControlOrder??99))) group.append(node);
  return group;
}
