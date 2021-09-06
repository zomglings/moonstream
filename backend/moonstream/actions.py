import json
import logging
from typing import Optional
from enum import Enum

import boto3  # type: ignore
from moonstreamdb.models import (
    EthereumAddress,
    EthereumLabel,
)
from sqlalchemy import text
from sqlalchemy.orm import Session

from . import data
from .reporter import reporter
from .settings import ETHERSCAN_SMARTCONTRACTS_BUCKET

logger = logging.getLogger(__name__)
ETHERSCAN_SMARTCONTRACT_LABEL_NAME = "etherscan_smartcontract"


def get_contract_source_info(
    db_session: Session, contract_address: str
) -> Optional[data.EthereumSmartContractSourceInfo]:
    query = db_session.query(EthereumAddress.id).filter(
        EthereumAddress.address == contract_address
    )
    id = query.one_or_none()
    if id is None:
        return None
    labels = (
        db_session.query(EthereumLabel).filter(EthereumLabel.address_id == id[0]).all()
    )

    for label in labels:
        if label.label == ETHERSCAN_SMARTCONTRACT_LABEL_NAME:
            object_uri = label.label_data["object_uri"]
            key = object_uri.split("s3://etherscan-smart-contracts/")[1]
            s3 = boto3.client("s3")
            bucket = ETHERSCAN_SMARTCONTRACTS_BUCKET
            try:
                raw_obj = s3.get_object(Bucket=bucket, Key=key)
                obj_data = json.loads(raw_obj["Body"].read().decode("utf-8"))["data"]
                contract_source_info = data.EthereumSmartContractSourceInfo(
                    name=obj_data["ContractName"],
                    source_code=obj_data["SourceCode"],
                    compiler_version=obj_data["CompilerVersion"],
                    abi=obj_data["ABI"],
                )
                return contract_source_info
            except Exception as e:
                logger.error(f"Failed to load smart contract {object_uri}")
                reporter.error_report(e)
    return None


class LabelNames(Enum):
    ETHERSCAN_SMARTCONTRACT = "etherscan_smartcontract"
    COINMARKETCAP_TOKEN = "coinmarketcap_token"
    ERC721 = "erc721"


def get_ethereum_address_info(
    db_session: Session, address: str
) -> Optional[data.EthereumAddressInfo]:
    query = db_session.query(EthereumAddress.id).filter(
        EthereumAddress.address == address
    )
    id = query.one_or_none()
    if id is None:
        return None

    address_info = data.EthereumAddressInfo(address=address)
    etherscan_address_url = f"https://etherscan.io/address/{address}"
    etherscan_token_url = f"https://etherscan.io/token/{address}"
    blockchain_com_url = f"https://www.blockchain.com/eth/address/{address}"
    # Checking for token:
    coinmarketcap_label: Optional[EthereumLabel] = (
        db_session.query(EthereumLabel)
        .filter(EthereumLabel.address_id == id[0])
        .filter(EthereumLabel.label == LabelNames.COINMARKETCAP_TOKEN.value)
        .order_by(text("created_at desc"))
        .limit(1)
        .one_or_none()
    )
    if coinmarketcap_label is not None:
        address_info.token = data.EthereumTokenDetails(
            name=coinmarketcap_label.label_data["name"],
            symbol=coinmarketcap_label.label_data["symbol"],
            external_url=[
                coinmarketcap_label.label_data["coinmarketcap_url"],
                etherscan_token_url,
                blockchain_com_url,
            ],
        )

    # Checking for smart contract
    etherscan_label: Optional[EthereumLabel] = (
        db_session.query(EthereumLabel)
        .filter(EthereumLabel.address_id == id[0])
        .filter(EthereumLabel.label == LabelNames.ETHERSCAN_SMARTCONTRACT.value)
        .order_by(text("created_at desc"))
        .limit(1)
        .one_or_none()
    )
    if etherscan_label is not None:
        address_info.smart_contract = data.EthereumSmartContractDetails(
            name=etherscan_label.label_data["name"],
            external_url=[etherscan_address_url, blockchain_com_url],
        )

    # Checking for NFT
    # Checking for smart contract
    erc721_label: Optional[EthereumLabel] = (
        db_session.query(EthereumLabel)
        .filter(EthereumLabel.address_id == id[0])
        .filter(EthereumLabel.label == LabelNames.ERC721.value)
        .order_by(text("created_at desc"))
        .limit(1)
        .one_or_none()
    )
    if erc721_label is not None:
        address_info.nft = data.EthereumNFTDetails(
            name=erc721_label.label_data.get("name"),
            symbol=erc721_label.label_data.get("symbol"),
            total_supply=erc721_label.label_data.get("totalSupply"),
            external_url=[etherscan_token_url, blockchain_com_url],
        )
    return address_info


def get_address_labels(
    db_session: Session, start: int, limit: int, addresses: Optional[str] = None
) -> data.AddressListLabelsResponse:
    """
    Attach labels to addresses.
    """
    query = db_session.query(EthereumAddress)
    if addresses is not None:
        addresses_list = addresses.split(",")
        query = query.filter(EthereumAddress.address.in_(addresses_list))

    addresses_obj = query.order_by(EthereumAddress.id).slice(start, start + limit).all()

    addresses_response = data.AddressListLabelsResponse(addresses=[])

    for address in addresses_obj:
        labels_obj = (
            db_session.query(EthereumLabel)
            .filter(EthereumLabel.address_id == address.id)
            .all()
        )
        addresses_response.addresses.append(
            data.AddressLabelsResponse(
                address=address.address,
                labels=[
                    data.AddressLabelResponse(
                        label=label.label, label_data=label.label_data
                    )
                    for label in labels_obj
                ],
            )
        )

    return addresses_response
