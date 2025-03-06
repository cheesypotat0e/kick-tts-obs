import asyncio
import csv
import sys

from google.cloud import firestore


async def main():
    client = firestore.AsyncClient()

    csv_file = sys.argv[1]
    with open(csv_file, "r") as f:

        reader = csv.reader(f)
        for row in reader:
            voice_key = row[0]
            voice_name = row[1]
            voice_platform = row[2]
            voice_model = row[3]
            voice_code = row[4]

            print(
                f"Adding voice: {voice_key} {voice_name} {voice_platform} {voice_model} {voice_code}"
            )

            res = (
                await client.collection("voices")
                .document(voice_key)
                .set(
                    {
                        "name": voice_name,
                        "platform": voice_platform,
                        "model": voice_model,
                        "code": voice_code,
                    }
                )
            )

            print(f"Voice added: {voice_key} Response: {res}")


if __name__ == "__main__":
    asyncio.run(main())
