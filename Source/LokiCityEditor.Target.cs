using UnrealBuildTool;
using System.Collections.Generic;

public class LokiCityEditorTarget : TargetRules
{
    public LokiCityEditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.V5;
        ExtraModuleNames.Add("LokiCity");
    }
}
