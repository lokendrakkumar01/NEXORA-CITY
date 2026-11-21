#include "LokiCharacter.h"
#include "LokiHealthComponent.h"
#include "LokiVehiclePawn.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Components/InputComponent.h"

ALokiCharacter::ALokiCharacter()
{
    PrimaryActorTick.bCanEverTick = false;
    SpringArm = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
    SpringArm->SetupAttachment(RootComponent);
    SpringArm->TargetArmLength = 360.f;
    SpringArm->SetRelativeLocation(FVector(0.f, 0.f, 70.f));
    SpringArm->bUsePawnControlRotation = true;
    Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("FollowCamera"));
    Camera->SetupAttachment(SpringArm);
    Camera->bUsePawnControlRotation = false;
    Health = CreateDefaultSubobject<ULokiHealthComponent>(TEXT("Health"));
    GetCharacterMovement()->MaxWalkSpeed = WalkSpeed;
    bUseControllerRotationYaw = false;
    GetCharacterMovement()->bOrientRotationToMovement = true;
    OnActorBeginOverlap.AddDynamic(this, &ALokiCharacter::OnOverlapBegin);
    OnActorEndOverlap.AddDynamic(this, &ALokiCharacter::OnOverlapEnd);
}
void ALokiCharacter::SetupPlayerInputComponent(UInputComponent* Input)
{
    Super::SetupPlayerInputComponent(Input);
    Input->BindAxis(TEXT("MoveForward"), this, &ALokiCharacter::MoveForward);
    Input->BindAxis(TEXT("MoveRight"), this, &ALokiCharacter::MoveRight);
    Input->BindAxis(TEXT("Turn"), this, &ALokiCharacter::Turn);
    Input->BindAxis(TEXT("LookUp"), this, &ALokiCharacter::LookUp);
    Input->BindAction(TEXT("Jump"), IE_Pressed, this, &ACharacter::Jump);
    Input->BindAction(TEXT("Jump"), IE_Released, this, &ACharacter::StopJumping);
    Input->BindAction(TEXT("Sprint"), IE_Pressed, this, &ALokiCharacter::StartSprint);
    Input->BindAction(TEXT("Sprint"), IE_Released, this, &ALokiCharacter::StopSprint);
    Input->BindAction(TEXT("Interact"), IE_Pressed, this, &ALokiCharacter::TryInteract);
}
void ALokiCharacter::MoveForward(float V) { if (Controller && V != 0.f) AddMovementInput(FRotationMatrix(FRotator(0, Controller->GetControlRotation().Yaw, 0)).GetUnitAxis(EAxis::X), V); }
void ALokiCharacter::MoveRight(float V) { if (Controller && V != 0.f) AddMovementInput(FRotationMatrix(FRotator(0, Controller->GetControlRotation().Yaw, 0)).GetUnitAxis(EAxis::Y), V); }
void ALokiCharacter::Turn(float V) { AddControllerYawInput(V); }
void ALokiCharacter::LookUp(float V) { AddControllerPitchInput(V); }
void ALokiCharacter::StartSprint() { GetCharacterMovement()->MaxWalkSpeed = SprintSpeed; }
void ALokiCharacter::StopSprint() { GetCharacterMovement()->MaxWalkSpeed = WalkSpeed; }
void ALokiCharacter::TryInteract() { if (NearbyVehicle.IsValid()) NearbyVehicle->Enter(this); }
void ALokiCharacter::OnOverlapBegin(AActor*, AActor* Other) { if (ALokiVehiclePawn* Vehicle = Cast<ALokiVehiclePawn>(Other)) NearbyVehicle = Vehicle; }
void ALokiCharacter::OnOverlapEnd(AActor*, AActor* Other) { if (NearbyVehicle.Get() == Other) NearbyVehicle.Reset(); }
