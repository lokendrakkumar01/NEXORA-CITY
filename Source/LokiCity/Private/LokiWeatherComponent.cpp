#include "LokiWeatherComponent.h"

ULokiWeatherComponent::ULokiWeatherComponent()
{
    PrimaryComponentTick.bCanEverTick = true;
}
void ULokiWeatherComponent::BeginPlay()
{
    Super::BeginPlay();
    NextChange = FMath::FRandRange(MinWeatherDuration, MaxWeatherDuration);
}
void ULokiWeatherComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
    Super::TickComponent(DeltaTime, TickType, ThisTickFunction);
    if (TransitionAlpha < 1.f)
    {
        TransitionAlpha = FMath::Min(1.f, TransitionAlpha + DeltaTime / FMath::Max(0.01f, TransitionDuration));
        if (TransitionAlpha >= 1.f) CurrentWeather = TargetWeather;
    }
    WeatherTimer += DeltaTime;
    if (WeatherTimer >= NextChange)
    {
        WeatherTimer = 0.f;
        PickNextWeather();
    }
}
void ULokiWeatherComponent::SetWeather(EWeatherState NewState)
{
    if (NewState == CurrentWeather) return;
    TargetWeather = NewState;
    TransitionAlpha = 0.f;
    OnWeatherChanged.Broadcast(NewState);
}
float ULokiWeatherComponent::GetRainIntensity() const
{
    const float target = CurrentWeather == EWeatherState::HeavyRain ? 1.f :
                         CurrentWeather == EWeatherState::LightRain ? 0.5f :
                         CurrentWeather == EWeatherState::Thunder ? 0.9f : 0.f;
    return FMath::Lerp(0.f, target, TransitionAlpha);
}
float ULokiWeatherComponent::GetFogDensity() const
{
    const float target = CurrentWeather == EWeatherState::Fog ? 0.045f :
                         CurrentWeather == EWeatherState::Thunder ? 0.022f :
                         CurrentWeather == EWeatherState::HeavyRain ? 0.015f : 0.004f;
    return FMath::Lerp(0.004f, target, TransitionAlpha);
}
void ULokiWeatherComponent::PickNextWeather()
{
    const TArray<EWeatherState> States = {
        EWeatherState::Clear, EWeatherState::LightRain,
        EWeatherState::HeavyRain, EWeatherState::Thunder, EWeatherState::Fog
    };
    NextChange = FMath::FRandRange(MinWeatherDuration, MaxWeatherDuration);
    SetWeather(States[FMath::RandRange(0, States.Num() - 1)]);
}
