#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "LokiMissionTrigger.generated.h"

class UBoxComponent;
class UTextRenderComponent;

UCLASS()
class LOKICITY_API ALokiMissionTrigger : public AActor
{
    GENERATED_BODY()
public:
    ALokiMissionTrigger();
protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TObjectPtr<UBoxComponent> Trigger;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TObjectPtr<UTextRenderComponent> Label;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Mission") FText MissionName = FText::FromString(TEXT("First Contact"));
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Mission") int32 Reward = 100;
    UFUNCTION() void OnMissionOverlap(UPrimitiveComponent* Overlapped, AActor* OtherActor, UPrimitiveComponent* OtherComponent, int32 OtherBodyIndex, bool bFromSweep, const FHitResult& Sweep);
private:
    bool bCompleted = false;
};
