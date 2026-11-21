#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "LokiPedestrian.generated.h"

UCLASS()
class LOKICITY_API ALokiPedestrian : public ACharacter
{
    GENERATED_BODY()
public:
    ALokiPedestrian();
protected:
    virtual void BeginPlay() override;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Routine") float WanderRadius = 1200.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Routine") float PauseBetweenWalks = 2.f;
private:
    FTimerHandle WanderTimer;
    FVector HomeLocation;
    void PickDestination();
};
