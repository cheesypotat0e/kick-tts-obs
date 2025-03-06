import asyncio
import csv
import os
import sys

from google.cloud import firestore

API_URL = os.getenv("API_URL")


async def main():
    client = firestore.AsyncClient()

    file = sys.argv[1]

    with open(file, "r") as f:
        reader = csv.reader(f)
        for row in reader:
            name = row[0]
            url = row[1]

            print("Adding bit: ", url, name)

            ref = client.collection("bits").document()

            await ref.set({"url": url, "name": name})

            print(f"Added bit: url: {url}, name: {name}, id: {ref.id}")


if __name__ == "__main__":
    asyncio.run(main())
