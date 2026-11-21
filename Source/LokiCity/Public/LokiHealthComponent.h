#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "LokiHealthComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnHealthChanged, float, CurrentHealth, float, MaxHealth);

UCLASS(ClassGroup=(LokiCity), meta=(BlueprintSpawnableComponent))
class LOKICITY_API ULokiHealthComponent : public UActorComponent
{
    GENERATED_BODY()
public:
    ULokiHealthComponent();
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category="Health", meta=(ClampMin="1")) float MaxHealth = 100.f;
    UPROPERTY(BlueprintReadOnly, Category="Health") float Health = 100.f;
    UPROPERTY(BlueprintAssignable, Category="Health") FOnHealthChanged OnHealthChanged;
    UFUNCTION(BlueprintCallable, Category="Health") void ApplyDamage(float Amount);
    UFUNCTION(BlueprintCallable, Category="Health") void RestoreHealth(float Amount);
    UFUNCTION(BlueprintPure, Category="Health") bool IsAlive() const { return Health > 0.f; }
protected:
    virtual void BeginPlay() override;
};
