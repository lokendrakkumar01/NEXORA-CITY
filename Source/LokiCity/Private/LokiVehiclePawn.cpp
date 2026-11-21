#include "LokiVehiclePawn.h"
#include "LokiCharacter.h"
#include "Camera/CameraComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/SphereComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Components/InputComponent.h"

ALokiVehiclePawn::ALokiVehiclePawn()
{
    PrimaryActorTick.bCanEverTick = true;
    Body = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("VehicleBody"));
    SetRootComponent(Body);
    Body->SetSimulatePhysics(true);
    Body->SetLinearDamping(0.15f);
    Body->SetAngularDamping(1.5f);
    Body->SetGenerateOverlapEvents(true);
    InteractionRange = CreateDefaultSubobject<USphereComponent>(TEXT("InteractionRange"));
    InteractionRange->SetupAttachment(Body);
    InteractionRange->SetSphereRadius(260.f);
    InteractionRange->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
    InteractionRange->SetCollisionResponseToAllChannels(ECR_Overlap);
    SpringArm = CreateDefaultSubobject<USpringArmComponent>(TEXT("VehicleSpringArm"));
    SpringArm->SetupAttachment(Body);
    SpringArm->TargetArmLength = 650.f;
    SpringArm->SetRelativeLocation(FVector(0.f, 0.f, 160.f));
    SpringArm->bUsePawnControlRotation = true;
    Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("VehicleCamera"));
    Camera->SetupAttachment(SpringArm);
    AutoPossessPlayer = EAutoReceiveInput::Disabled;
}
void ALokiVehiclePawn::SetupPlayerInputComponent(UInputComponent* Input)
{
    Super::SetupPlayerInputComponent(Input);
    Input->BindAxis(TEXT("VehicleThrottle"), this, &ALokiVehiclePawn::SetThrottle);
    Input->BindAxis(TEXT("VehicleSteer"), this, &ALokiVehiclePawn::SetSteering);
    Input->BindAction(TEXT("Interact"), IE_Pressed, this, &ALokiVehiclePawn::ExitVehicle);
    Input->BindAction(TEXT("VehicleBrake"), IE_Pressed, this, &ALokiVehiclePawn::Brake);
}
void ALokiVehiclePawn::SetThrottle(float Value) { Throttle = FMath::Clamp(Value, -1.f, 1.f); }
void ALokiVehiclePawn::SetSteering(float Value) { Steering = FMath::Clamp(Value, -1.f, 1.f); }
void ALokiVehiclePawn::Brake() { if (Body) Body->SetPhysicsLinearVelocity(Body->GetPhysicsLinearVelocity() * 0.72f); }
void ALokiVehiclePawn::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (!Body || !Body->IsSimulatingPhysics()) return;
    const FVector Velocity = Body->GetPhysicsLinearVelocity();
    if (FMath::Abs(Throttle) > KINDA_SMALL_NUMBER && Velocity.Size() < MaxSpeed)
        Body->AddForce(GetActorForwardVector() * Throttle * DriveForce);
    if (FMath::Abs(Steering) > KINDA_SMALL_NUMBER && Velocity.SizeSquared() > 10000.f)
        Body->AddTorqueInRadians(FVector(0.f, 0.f, Steering * SteeringTorque), NAME_None, true);
}
void ALokiVehiclePawn::Enter(ALokiCharacter* Character)
{
    if (!Character || !Character->GetController()) return;
    Driver = Character;
    Character->SetActorHiddenInGame(true);
    Character->SetActorEnableCollision(false);
    Character->GetCharacterMovement()->DisableMovement();
    Character->GetController()->Possess(this);
}
void ALokiVehiclePawn::ExitVehicle()
{
    ALokiCharacter* Character = Driver.Get();
    APlayerController* PC = Cast<APlayerController>(GetController());
    if (!Character || !PC) return;
    const FVector ExitLocation = GetActorLocation() + GetActorRightVector() * 240.f + FVector(0.f, 0.f, 80.f);
    Character->SetActorLocation(ExitLocation, false, nullptr, ETeleportType::TeleportPhysics);
    Character->SetActorHiddenInGame(false);
    Character->SetActorEnableCollision(true);
    Character->GetCharacterMovement()->SetMovementMode(MOVE_Walking);
    PC->Possess(Character);
    Driver.Reset();
}
