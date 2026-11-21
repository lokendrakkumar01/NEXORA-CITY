#pragma once
#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "LokiGameMode.generated.h"

class ULokiWeatherComponent;

UCLASS()
class LOKICITY_API ALokiGameMode : public AGameModeBase
{
    GENERATED_BODY()
public:
    ALokiGameMode();
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="Weather")
    TObjectPtr<ULokiWeatherComponent> Weather;
};
