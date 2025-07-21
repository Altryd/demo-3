from typing import List

from langchain_core.messages import HumanMessage, SystemMessage


def convert_to_messages(history_records: List[dict]) -> List:
    """Преобразует записи из базы в объекты сообщений LangChain."""
    messages = []
    for record in history_records:
        if record.role.value == "user":
            messages.append(HumanMessage(content=record.text))
        elif record.role.value == "assistant" or record.role.value == "system":
            messages.append(SystemMessage(content=record.text))
    return messages

"""
def convert_to_messages(history_records: List[dict]) -> List:
    # ""Преобразует записи из базы в объекты сообщений LangChain.""
    messages = []
    for record in history_records:
        if record["role"] == "human":
            messages.append(HumanMessage(content=record["content"]))
        elif record["role"] == "system":
            messages.append(SystemMessage(content=record["content"]))
    return messages
"""