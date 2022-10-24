import {BindingScope, injectable, service} from '@loopback/core';
import {Filter} from '@loopback/repository';
import {Report, Server} from '../models';
import {ReportService} from './report.service';
import {ServerService} from './server.service';

@injectable({scope: BindingScope.TRANSIENT})
export class AdminService {
  constructor(
    @service(ServerService)
    private serverService: ServerService,
    @service(ReportService)
    private reportService: ReportService,
  ) {}

  // ------------------------------------------------

  // ------ Server ----------------------------------

  public async server(): Promise<Server> {
    return this.serverService.find();
  }

  public async registerServer(server: Omit<Server, 'id'>): Promise<Server> {
    return this.serverService.create(server);
  }

  public async updateServer(server: Partial<Server>): Promise<void> {
    return this.serverService.update(server);
  }

  // ------------------------------------------------

  // ------ Report ----------------------------------

  public async reports(filter?: Filter<Report>): Promise<Report[]> {
    return this.reportService.find(filter);
  }

  public async report(id: string, filter?: Filter<Report>): Promise<Report> {
    return this.reportService.findById(id, filter);
  }

  public async processReport(
    id: string,
    report: Partial<Report>,
  ): Promise<void> {
    return this.reportService.updateById(id, report);
  }

  public async removeReport(id: string): Promise<void> {
    const {referenceId, referenceType} = await this.reportService.findById(id);

    await this.reportService.deleteById(id);
    await this.reportService.deleteAll({referenceId, referenceType});

    this.reportService.updateReport(
      referenceId,
      referenceType,
      true,
    ) as Promise<void>;
  }

  // ------------------------------------------------
}
