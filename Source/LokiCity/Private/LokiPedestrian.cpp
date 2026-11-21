#include "LokiPedestrian.h"
#include "AIController.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "TimerManager.h"

ALokiPedestrian::ALokiPedestrian()
{
    AIControllerClass = AAIController::StaticClass();
    AutoPossessAI = EAutoPossessAI::PlacedInWorldOrSpawned;
    GetCharacterMovement()->MaxWalkSpeed = 210.f;
}
void ALokiPedestrian::BeginPlay()
{
    Super::BeginPlay();
    HomeLocation = GetActorLocation();
    GetWorldTimerManager().SetTimer(WanderTimer, this, &ALokiPedestrian::PickDestination, 0.5f, true);
}
void ALokiPedestrian::PickDestination()
{
    AAIController* AI = Cast<AAIController>(GetController());
    if (!AI) return;
    const FVector2D Offset = FMath::RandPointInCircle(WanderRadius);
    AI->MoveToLocation(HomeLocation + FVector(Offset.X, Offset.Y, 0.f), 60.f);
    GetWorldTimerManager().SetTimer(WanderTimer, this, &ALokiPedestrian::PickDestination, PauseBetweenWalks + FMath::FRandRange(2.f, 6.f), false);
}
