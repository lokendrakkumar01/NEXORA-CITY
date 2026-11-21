#include "LokiMissionTrigger.h"
#include "LokiCharacter.h"
#include "Components/BoxComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/Engine.h"

ALokiMissionTrigger::ALokiMissionTrigger()
{
    Trigger = CreateDefaultSubobject<UBoxComponent>(TEXT("MissionTrigger"));
    SetRootComponent(Trigger);
    Trigger->SetBoxExtent(FVector(180.f, 180.f, 120.f));
    Trigger->SetCollisionProfileName(TEXT("Trigger"));
    Trigger->OnComponentBeginOverlap.AddDynamic(this, &ALokiMissionTrigger::OnMissionOverlap);
    Label = CreateDefaultSubobject<UTextRenderComponent>(TEXT("MissionLabel"));
    Label->SetupAttachment(Trigger);
    Label->SetRelativeLocation(FVector(0.f, 0.f, 160.f));
    Label->SetHorizontalAlignment(EHTA_Center);
    Label->SetText(FText::FromString(TEXT("MISSION")));
}
void ALokiMissionTrigger::OnMissionOverlap(UPrimitiveComponent*, AActor* OtherActor, UPrimitiveComponent*, int32, bool, const FHitResult&)
{
    if (bCompleted || !Cast<ALokiCharacter>(OtherActor)) return;
    bCompleted = true;
    Label->SetText(FText::FromString(TEXT("COMPLETE")));
    if (GEngine) GEngine->AddOnScreenDebugMessage(-1, 5.f, FColor::Green, FString::Printf(TEXT("Mission complete: %s | Reward: $%d"), *MissionName.ToString(), Reward));
}
