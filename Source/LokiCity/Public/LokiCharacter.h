#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "LokiCharacter.generated.h"

class UCameraComponent;
class USpringArmComponent;
class ULokiHealthComponent;
class ALokiVehiclePawn;
class UInputMappingContext;
class UInputAction;

UCLASS()
class LOKICITY_API ALokiCharacter : public ACharacter
{
    GENERATED_BODY()
public:
    ALokiCharacter();
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
    UFUNCTION(BlueprintCallable, Category="Interaction") void TryInteract();
    UFUNCTION(BlueprintPure, Category="Health") ULokiHealthComponent* GetHealthComponent() const { return Health; }

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input", meta=(AllowPrivateAccess="true"))
    TObjectPtr<class UInputMappingContext> DefaultMappingContext;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input")
    float BaseTurnRate = 65.f;
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Input")
    float BaseLookUpRate = 65.f;

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TObjectPtr<USpringArmComponent> SpringArm;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TObjectPtr<UCameraComponent> Camera;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TObjectPtr<ULokiHealthComponent> Health;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Movement") float SprintSpeed = 850.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Movement") float WalkSpeed = 500.f;
private:
    TWeakObjectPtr<ALokiVehiclePawn> NearbyVehicle;
    void MoveForward(float Value);
    void MoveRight(float Value);
    void LookUp(float Value);
    void Turn(float Value);
    void StartSprint();
    void StopSprint();
    UFUNCTION()
    void OnOverlapBegin(AActor* OverlappedActor, AActor* OtherActor);
    UFUNCTION()
    void OnOverlapEnd(AActor* OverlappedActor, AActor* OtherActor);
};
