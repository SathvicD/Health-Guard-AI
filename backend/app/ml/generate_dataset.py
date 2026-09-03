import random

import numpy as np
import pandas as pd


def generate_normal_behavior(
    samples: int = 100,
):
    """
    Generate synthetic normal healthcare
    access behavior.
    """

    data = []

    for _ in range(samples):

        total_accesses = random.randint(5, 30)

        denied_accesses = random.randint(0, 2)

        allowed_accesses = (
            total_accesses - denied_accesses
        )

        unique_patients = random.randint(
            3,
            min(total_accesses, 20),
        )

        unique_documents = random.randint(
            3,
            min(total_accesses, 25),
        )

        view_count = allowed_accesses

        # Normal working hours
        average_access_hour = np.random.normal(
            loc=12,
            scale=2.5,
        )

        average_access_hour = max(
            8,
            min(18, average_access_hour),
        )

        night_access_count = random.randint(
            0,
            1,
        )

        data.append(
            {
                "total_accesses": total_accesses,
                "allowed_accesses": allowed_accesses,
                "denied_accesses": denied_accesses,
                "unique_patients": unique_patients,
                "unique_documents": unique_documents,
                "view_count": view_count,
                "average_access_hour": average_access_hour,
                "night_access_count": night_access_count,
                "behavior": "normal",
            }
        )

    return data


def generate_suspicious_behavior(
    samples: int = 20,
):
    """
    Generate synthetic suspicious healthcare
    access behavior.
    """

    data = []

    for _ in range(samples):

        total_accesses = random.randint(
            100,
            500,
        )

        denied_accesses = random.randint(
            10,
            80,
        )

        allowed_accesses = (
            total_accesses - denied_accesses
        )

        unique_patients = random.randint(
            50,
            300,
        )

        unique_documents = random.randint(
            50,
            400,
        )

        view_count = allowed_accesses

        # Suspicious late-night activity
        average_access_hour = random.choice(
            [
                random.uniform(0, 5),
                random.uniform(22, 23.9),
            ]
        )

        night_access_count = random.randint(
            10,
            100,
        )

        data.append(
            {
                "total_accesses": total_accesses,
                "allowed_accesses": allowed_accesses,
                "denied_accesses": denied_accesses,
                "unique_patients": unique_patients,
                "unique_documents": unique_documents,
                "view_count": view_count,
                "average_access_hour": average_access_hour,
                "night_access_count": night_access_count,
                "behavior": "suspicious",
            }
        )

    return data


def create_dataset(
    normal_samples: int = 100,
    suspicious_samples: int = 20,
):
    """
    Create a combined dataset containing
    normal and suspicious behavior.
    """

    normal_data = generate_normal_behavior(
        normal_samples
    )

    suspicious_data = generate_suspicious_behavior(
        suspicious_samples
    )

    dataset = normal_data + suspicious_data

    random.shuffle(dataset)

    return pd.DataFrame(dataset)


if __name__ == "__main__":

    df = create_dataset()

    print("\nHealthGuard AI ML Dataset")
    print("=" * 40)

    print(f"Total samples: {len(df)}")

    print(
        f"Normal samples: "
        f"{(df['behavior'] == 'normal').sum()}"
    )

    print(
        f"Suspicious samples: "
        f"{(df['behavior'] == 'suspicious').sum()}"
    )

    print("\nSample records:")
    print(
        df.head(10).to_string(
            index=False
        )
    )

    print("\nDataset statistics:")
    print(
        df.describe().round(2)
    )