# LOKI CITY — first playable prototype

Original open world action adventure prototype for Windows and Unreal Engine 5. The code in this repository provides a small C++ gameplay foundation. It does not contain authored character, vehicle, building, animation, or city assets; create those in Unreal Editor as described below.

## Play the browser prototype

The browser-playable city scene is in `web/`. It runs locally without installing Unreal Engine or any npm packages:

1. Install Node.js if it is not already installed.
2. Open a terminal in the `web` folder and run `npm start`.
3. Open `http://localhost:4173` in a browser.

Use **WASD** to move, **Shift** to sprint, **Space** to hop, **E** near the Vela GT to enter or exit, and **Escape** to pause. In the car, **W/S** accelerate/reverse and **A/D** steer. Reach Neon Market to complete the first delivery objective. The browser version is a lightweight original canvas-based visual prototype; it is separate from the Unreal C++ project and does not load Unreal assets.

## Project setup

1. Install Unreal Engine 5.6 and Visual Studio 2022 with **Game development with C++**, the Windows SDK, and MSVC. The project file currently targets UE 5.6 (`LokiCity.uproject`).
2. Open `LokiCity.uproject`, let Unreal generate project files, then compile the **LokiCityEditor** target in Visual Studio or use the editor's compile command.
3. In Unreal Editor, create a level named `Content/Maps/SmallCity` and set it as the Editor Startup Map and Game Default Map in **Project Settings → Maps & Modes**. Save it.
4. Create Blueprint children of `LokiCharacter`, `LokiVehiclePawn`, and `LokiPedestrian`. Assign Skeletal Meshes and Anim Blueprints to character children; assign a Static Mesh to the vehicle child's inherited `Body` component. Keep collision enabled on that mesh. Use simple placeholder meshes initially.
5. In the level, add a `PlayerStart`, the character Blueprint is selected automatically by `ALokiGameMode`. Add three blockout buildings with cubes/meshes, roads as flat meshes, one vehicle Blueprint, several pedestrian Blueprints, and one `LokiMissionTrigger` actor.
6. Build lighting with a Directional Light, Sky Atmosphere, Sky Light, and ground plane. Keep the blockout small (a few city blocks) and use World Partition only when the map grows beyond the prototype.
7. Press Play. Move with **WASD**, look with the mouse, jump with **Space**, sprint with **Left Shift**, enter/exit a nearby vehicle with **E**. Drive with **WASD**, brake with **Space**. Walking into the mission trigger completes the one-step mission and prints its reward.

## Input map

Legacy input mappings are in `Config/DefaultInput.ini`. The character and vehicle bind to those names. If you switch the project to Enhanced Input, replace those bindings with Input Actions and Mapping Context assets and add the Enhanced Input module to `LokiCity.Build.cs`.

## Source layout

```text
LokiCity.uproject
Config/
  DefaultEngine.ini       # default game mode
  DefaultInput.ini        # prototype keyboard/mouse map
Source/
  LokiCity.Target.cs
  LokiCityEditor.Target.cs
  LokiCity/
    LokiCity.Build.cs
    Public/                # UCLASS declarations
    Private/               # implementations
```

| Class | Role |
|---|---|
| `ALokiGameMode` | Sets the default player pawn. |
| `ALokiCharacter` | Third-person movement, spring arm camera, interaction and health component. |
| `ULokiHealthComponent` | Health state, damage/healing calls, Blueprint event, disables collision at zero health. |
| `ALokiVehiclePawn` | Physics body, chase camera, throttle/steering/brake, player possession handoff. |
| `ALokiPedestrian` | Basic AIController driven random point-to-point wandering. |
| `ALokiMissionTrigger` | One-time overlap objective completion with a configurable name and reward. |

## Blueprint and level integration

- **Player:** Create `BP_LokiCharacter` based on `LokiCharacter`, assign a mannequin or original character mesh, set its relative transform so feet align with the capsule, and assign an animation Blueprint. Put a `PlayerStart` in the level.
- **Car:** Create `BP_LokiVehicle` based on `LokiVehiclePawn`, assign a suitably scaled car mesh to `Body`, and tune `DriveForce`, `SteeringTorque`, `MaxSpeed`, mass, damping, and collision. The starter controller uses a rigid body for a prototype feel; it is not a wheel suspension/Chaos Vehicles implementation. Swap in Chaos Vehicles when wheel assets and suspension tuning are ready.
- **City:** Block out three distinct buildings (for example, a residential block, shop, and clinic), a connecting road, sidewalks, and a small park with engine primitives or original Blender meshes. Enable Nanite on suitable static meshes after the blockout. Avoid Nanite on skeletal meshes.
- **Pedestrians:** Place `BP_LokiPedestrian` instances on walkable ground. For reliable wandering, add a Nav Mesh Bounds Volume around sidewalks and press **P** to inspect coverage. The current sample chooses destinations in a radius and asks its AI controller to navigate there.
- **Mission:** Place `LokiMissionTrigger`, adjust its box, and edit `MissionName` and `Reward`. This is a one-step prototype trigger; it does not yet include multi-objective state, persistence, or a full UMG notification system.
- **Health:** Call `GetHealthComponent()->ApplyDamage(amount)` from gameplay code or Blueprint. Bind `OnHealthChanged` in a widget Blueprint to display a health bar. At zero, collision is disabled; implement respawn/game-over policy before expanding gameplay.

## Build.cs dependencies

`LokiCity.Build.cs` includes Core, CoreUObject, Engine, InputCore, and PhysicsCore. AI wandering uses the engine's AIController and movement APIs without a separate plugin dependency. Enable the **AI Navigation** plugin if the project template/engine version does not provide runtime navigation by default.

## Current scope and next implementation steps

Implemented in source: third-person movement/camera, sprint/jump, health component, interact-based vehicle possession, a simple physics car, basic wandering NPCs, and a one-step mission trigger. To reach the stated milestone in a running editor, create the Blueprint children and small map above and assign placeholder meshes.

Not implemented yet: authored city/environment, swim/climb/crouch, inventory/weapons, Chaos Vehicles wheel simulation, vehicle persistence, pedestrian dialogue/routines, traffic/police AI, multi-stage missions/save system, minimap, UMG menus, weather/day cycle, and performance profiling. These are later milestones; this starter does not claim them as complete.
