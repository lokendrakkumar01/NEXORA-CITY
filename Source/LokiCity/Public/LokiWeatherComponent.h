#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "LokiWeatherComponent.generated.h"

UENUM(BlueprintType)
enum class EWeatherState : uint8
{
    Clear       UMETA(DisplayName="Clear"),
    LightRain   UMETA(DisplayName="Light Rain"),
    HeavyRain   UMETA(DisplayName="Heavy Rain"),
    Thunder     UMETA(DisplayName="Thunderstorm"),
    Fog         UMETA(DisplayName="Dense Fog"),
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnWeatherChanged, EWeatherState, NewState);

UCLASS(ClassGroup=(LokiCity), meta=(BlueprintSpawnableComponent))
class LOKICITY_API ULokiWeatherComponent : public UActorComponent
{
    GENERATED_BODY()
public:
    ULokiWeatherComponent();
    UPROPERTY(BlueprintAssignable, Category="Weather") FOnWeatherChanged OnWeatherChanged;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Weather") float TransitionDuration = 8.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Weather") float MinWeatherDuration = 45.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Weather") float MaxWeatherDuration = 180.f;
    UPROPERTY(BlueprintReadOnly, Category="Weather") EWeatherState CurrentWeather = EWeatherState::LightRain;
    UPROPERTY(BlueprintReadOnly, Category="Weather") float TransitionAlpha = 1.f;
    UFUNCTION(BlueprintCallable, Category="Weather") void SetWeather(EWeatherState NewState);
    UFUNCTION(BlueprintPure, Category="Weather") float GetRainIntensity() const;
    UFUNCTION(BlueprintPure, Category="Weather") float GetFogDensity() const;
protected:
    virtual void BeginPlay() override;
    virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;
private:
    EWeatherState TargetWeather = EWeatherState::LightRain;
    float WeatherTimer = 0.f;
    float NextChange = 60.f;
    void PickNextWeather();
};
