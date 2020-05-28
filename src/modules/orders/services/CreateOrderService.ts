import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
  price: number;
}

interface IFindProducts {
  id: string;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('User not found.');
    }

    const idProducts: IFindProducts[] = [];
    products.forEach(product => {
      idProducts.push({ id: product.id });
    });

    const foundProducts = await this.productsRepository.findAllById(idProducts);

    if (foundProducts.length !== idProducts.length) {
      throw new AppError('Invalid products in this order.');
    }

    const checkProducts = foundProducts.map(stockProduct => {
      const orderProduct = products.find(item => item.id === stockProduct.id);

      if (!orderProduct) {
        console.log('invalid product');
        throw new AppError('Product does not exist.', 400);
      }

      if (stockProduct.quantity < orderProduct.quantity) {
        throw new AppError('Product out of stock.');
      }

      const parsedProduct = {
        product_id: orderProduct.id,
        quantity: orderProduct.quantity,
        price: stockProduct.price,
      };

      return parsedProduct;
    });

    const order = await this.ordersRepository.create({
      customer,
      products: checkProducts,
    });

    const updateProducts = checkProducts.map(product => {
      const updateProduct = {
        id: product.product_id,
        quantity: product.quantity,
      };
      return updateProduct;
    });

    await this.productsRepository.updateQuantity(updateProducts);
    return order;
  }
}

export default CreateOrderService;
