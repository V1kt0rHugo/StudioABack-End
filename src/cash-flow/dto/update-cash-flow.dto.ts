import { PartialType } from '@nestjs/mapped-types';
import { CreateCashFlowDto } from './create-cash-flow.dto';

export class UpdateCashFlowDto extends PartialType(CreateCashFlowDto) {}
