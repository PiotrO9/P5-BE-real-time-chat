import { Response } from 'express';
import { ApiResponse } from '../types/friends';

/**
 * Helper do tworzenia standardowych odpowiedzi API
 */
export class ResponseHelper {
  /**
   * Tworzy odpowiedź sukcesu
   */
  static success<T>(res: Response, message: string, data?: T, statusCode: number = 200): void {
    const response: ApiResponse<T> = {
      success: true,
      message,
      ...(data && { data })
    };
    
    res.status(statusCode).json(response);
  }

  /**
   * Tworzy odpowiedź błędu
   */
  static error(res: Response, message: string, statusCode: number = 400, errors?: Array<{ field: string; message: string }>): void {
    const response: ApiResponse = {
      success: false,
      message,
      ...(errors && { errors })
    };
    
    res.status(statusCode).json(response);
  }

  /**
   * Tworzy odpowiedź błędu walidacji
   */
  static validationError(res: Response, errors: Array<{ field: string; message: string }>): void {
    this.error(res, 'Nieprawidłowe dane', 400, errors);
  }

  /**
   * Tworzy odpowiedź błędu autoryzacji
   */
  static unauthorized(res: Response, message: string = 'Brak autoryzacji użytkownika'): void {
    this.error(res, message, 401);
  }

  /**
   * Tworzy odpowiedź błędu uprawnień
   */
  static forbidden(res: Response, message: string = 'Brak uprawnień'): void {
    this.error(res, message, 403);
  }

  /**
   * Tworzy odpowiedź błędu nie znaleziono
   */
  static notFound(res: Response, message: string = 'Nie znaleziono'): void {
    this.error(res, message, 404);
  }

  /**
   * Tworzy odpowiedź błędu serwera
   */
  static serverError(res: Response, message: string = 'Błąd serwera'): void {
    this.error(res, message, 500);
  }
}
