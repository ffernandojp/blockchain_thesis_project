// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TrazabilidadMaizNFT
 * @dev Contrato para la tokenización de lotes de maíz para exportación.
 * Cada NFT representa un lote físico consolidado, con su metadata IPFS.
 */
contract TrazabilidadMaizNFT is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    event LoteExportado(uint256 indexed tokenId, address indexed exportador, string tokenURI);

    constructor() ERC721("Maiz Trazabilidad Argentina", "MAIZ") Ownable(msg.sender) {}

    /**
     * @dev Acuña (mints) un nuevo NFT que representa un lote de exportación.
     * @param exportador Dirección del exportador que recibe el NFT.
     * @param uri URI del token (típicamente un enlace a IPFS con el historial completo).
     * @return El ID del token recién acuñado.
     */
    function emitirCertificadoExportacion(address exportador, string memory uri) public onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(exportador, tokenId);
        _setTokenURI(tokenId, uri);
        
        emit LoteExportado(tokenId, exportador, uri);
        return tokenId;
    }
}
