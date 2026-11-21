#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "LokiVehiclePawn.generated.h"

class UCameraComponent;
class USpringArmComponent;
class UStaticMeshComponent;
class USphereComponent;
class ALokiCharacter;

UCLASS()
class LOKICITY_API ALokiVehiclePawn : public APawn
{
    GENERATED_BODY()
public:
    ALokiVehiclePawn();
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
    virtual void Tick(float DeltaSeconds) override;
    void Enter(ALokiCharacter* Character);
protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TObjectPtr<UStaticMeshComponent> Body;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TObjectPtr<USphereComponent> InteractionRange;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TObjectPtr<USpringArmComponent> SpringArm;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly) TObjectPtr<UCameraComponent> Camera;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Vehicle") float DriveForce = 950000.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Vehicle") float SteeringTorque = 3000000.f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Vehicle") float MaxSpeed = 4200.f;
private:
    TWeakObjectPtr<ALokiCharacter> Driver;
    float Throttle = 0.f;
    float Steering = 0.f;
    void SetThrottle(float Value);
    void SetSteering(float Value);
    void Brake();
    void ExitVehicle();
};
