#include "LokiGameMode.h"
#include "LokiCharacter.h"
#include "LokiWeatherComponent.h"

ALokiGameMode::ALokiGameMode()
{
    DefaultPawnClass = ALokiCharacter::StaticClass();
    Weather = CreateDefaultSubobject<ULokiWeatherComponent>(TEXT("WeatherSystem"));
}
