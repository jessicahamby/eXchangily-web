import { Component, ViewEncapsulation, OnInit } from '@angular/core';
import { KanbanService } from '../../services/kanban.service';
@Component({
    selector: 'app-explorer',
    templateUrl: './explorer.component.html',
    styleUrls: ['./explorer.component.css'],
    encapsulation: ViewEncapsulation.None
})
export class ExplorerComponent implements OnInit {
    latestBlock: any;
    latestBlockNumber: number;
    difficulty: string;
    timeOfLastBlock: string;
    totalAddress: string;

    blocks: any;

    transactions: any;    

    constructor(private kanbanServ: KanbanService) {
        
    }    

    ngOnInit() {
        this.kanbanServ.getLatestTransactions(5).subscribe(
            (transactions: any) => {
                this.transactions = transactions.txs;
            }
        );
        
        this.kanbanServ.getLatestBlocks().subscribe(
            (blocks: any) => {
                this.blocks = blocks;
                if (this.blocks && this.blocks.length > 0) {
                    this.latestBlock = this.blocks[0];
                    this.difficulty = this.latestBlock.totalDifficulty;
                    this.latestBlockNumber = this.latestBlock.number;
                    this.timeOfLastBlock = this.latestBlock.timestamp;
                }
            }
        );
    }

    search (searchText: string) {
        console.log('searchText=' + searchText);
    }
}
