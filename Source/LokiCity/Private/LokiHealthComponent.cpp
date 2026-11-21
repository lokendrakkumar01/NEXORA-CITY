#include "LokiHealthComponent.h"
#include "GameFramework/Actor.h"

ULokiHealthComponent::ULokiHealthComponent() { PrimaryComponentTick.bCanEverTick = false; }
void ULokiHealthComponent::BeginPlay() { Super::BeginPlay(); MaxHealth = FMath::Max(1.f, MaxHealth); Health = MaxHealth; }
void ULokiHealthComponent::ApplyDamage(float Amount)
{
    if (Amount <= 0.f || Health <= 0.f) return;
    Health = FMath::Clamp(Health - Amount, 0.f, MaxHealth);
    OnHealthChanged.Broadcast(Health, MaxHealth);
    if (Health <= 0.f)
        if (AActor* Owner = GetOwner()) Owner->SetActorEnableCollision(false);
}
void ULokiHealthComponent::RestoreHealth(float Amount)
{
    if (Amount <= 0.f) return;
    Health = FMath::Clamp(Health + Amount, 0.f, MaxHealth);
    if (Health > 0.f) GetOwner()->SetActorEnableCollision(true);
    OnHealthChanged.Broadcast(Health, MaxHealth);
}
